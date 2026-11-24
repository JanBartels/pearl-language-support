// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type { AnalysisResult } from '../validation/analysisResult';
import type { AnalysisExecutionInput, AnalysisExecutor } from './analysisExecutor';
import {
    type WorkerAnalyzeRequest, type WorkerAnalysisInput,
    type WorkerAnalysisResponse, type WorkerAnalyzeLog
} from './analysisWorkerProtocol';
import { decodeAnalysisResult } from './transport/analysisResultTransport';

export interface WorkerAnalysisMetrics {
    readonly uri: string;
    readonly queueMs: number;
    /** Synchronous cost of posting the request in the LSP main thread. */
    readonly requestPostMs: number;
    /** From request-post completion until receipt in the worker. */
    readonly requestTransferMs: number;
    /** Worker setup before invoking Validator.analyze(). */
    readonly workerSetupMs: number;
    readonly analyzeMs: number;
    readonly encodeMs: number;
    /** From start of worker response postMessage to main-thread receipt. */
    readonly resultTransferMs: number;
    readonly decodeMs: number;
    /** Remaining scheduling/callback cost; normally close to zero. */
    readonly otherMs: number;
    /** End-to-end duration including the executor's own queue. */
    readonly totalMs: number;
}

export interface WorkerExecutorCallbacks {
    readonly onMetrics?: (metrics: WorkerAnalysisMetrics) => void;
    readonly onLog?: (level: WorkerAnalyzeLog['level'], message: string) => void;
}

/** The minimal worker API also makes termination and protocol failures testable. */
export interface AnalysisWorkerHandle {
    postMessage(message: WorkerAnalyzeRequest): void;
    on(event: 'message', listener: (message: WorkerAnalysisResponse) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'exit', listener: (code: number) => void): this;
    terminate(): Promise<number>;
}

interface PendingJob {
    readonly id: number;
    readonly input: WorkerAnalysisInput;
    readonly started: number;
    dispatchedAt?: number;
    requestPostedAtMs?: number;
    requestPostMs?: number;
    readonly resolve: (result: AnalysisResult) => void;
    readonly reject: (error: Error) => void;
}

/**
 * A single persistent worker. Requests are sent FIFO one at a time.
 * No scheduling, version decisions or DocumentRegistry state is kept here.
 * A broken worker rejects outstanding work; it never silently falls back to
 * the local executor, because doing so would reintroduce event-loop blocking.
 */
export class WorkerAnalysisExecutor implements AnalysisExecutor {
    private readonly worker: AnalysisWorkerHandle;
    private readonly queue: PendingJob[] = [];
    private active: PendingJob | undefined;
    private nextId = 1;
    private disposed = false;
    private failure: Error | undefined;

    constructor(
        workerFile: string,
        private readonly callbacks: WorkerExecutorCallbacks = {},
        makeWorker: (file: string) => AnalysisWorkerHandle = file => new Worker(file, { execArgv: [] })
    ) {
        this.worker = makeWorker(workerFile);
        this.worker.on('message', message => this.receive(message));
        this.worker.on('error', error => this.fail(error));
        this.worker.on('exit', code => this.fail(new Error(`Analysis worker exited with code ${code}`)));
    }

    execute(input: AnalysisExecutionInput): Promise<AnalysisResult> {
        if (this.disposed) return Promise.reject(new Error('Analysis worker executor is disposed'));
        if (this.failure) return Promise.reject(this.failure);
        if (!input.includeSnapshots) {
            return Promise.reject(new Error('Analysis worker requires captured include snapshots'));
        }
        return new Promise((resolve, reject) => {
            this.queue.push({
                id: this.nextId++, input: input as WorkerAnalysisInput,
                started: performance.now(), resolve, reject
            });
            this.dispatch();
        });
    }

    /** Called by the LSP orchestrator on shutdown; queued and active jobs fail. */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.rejectAll(new Error('Analysis worker executor was shut down'));
        void this.worker.terminate().catch(() => undefined);
    }

    private dispatch(): void {
        if (this.active || this.queue.length === 0 || this.disposed || this.failure) return;
        const job = this.queue.shift()!;
        this.active = job;
        try {
            job.dispatchedAt = performance.now();
            job.requestPostedAtMs = performance.timeOrigin + job.dispatchedAt;
            this.worker.postMessage({ type: 'analyze', id: job.id, input: job.input });
            job.requestPostMs = performance.now() - job.dispatchedAt;
        } catch (error) {
            this.active = undefined;
            job.reject(error instanceof Error ? error : new Error(String(error)));
            this.dispatch();
        }
    }

    private receive(message: WorkerAnalysisResponse): void {
        const receivedAtMs = performance.timeOrigin + performance.now();
        if (this.disposed || this.failure) return;
        const job = this.active;
        if (!job || !message || message.id !== job.id) {
            this.fail(new Error('Unexpected analysis worker response identity'));
            return;
        }
        if (message.type === 'log') {
            this.callbacks.onLog?.(message.level, message.message);
            return;
        }
        this.active = undefined;
        if (message.type === 'error') {
            const error = new Error(message.message);
            error.name = message.name;
            if (message.stack !== undefined) error.stack = message.stack;
            job.reject(error);
        } else if (message.type === 'result') {
            try {
                const decodeStart = performance.now();
                const result = decodeAnalysisResult(message.wire);
                const decodeMs = performance.now() - decodeStart;
                const totalMs = performance.now() - job.started;
                const queueMs = (job.dispatchedAt ?? job.started) - job.started;
                const requestPostMs = job.requestPostMs ?? 0;
                // Both threads share Node's performance.timeOrigin. Each transit
                // time includes structured-clone work and event-loop scheduling.
                const requestTransferMs = Math.max(0, message.workerReceivedAtMs
                    - ((job.requestPostedAtMs ?? 0) + requestPostMs));
                const workerSetupMs = Math.max(0, message.workerAnalyzeStartedAtMs
                    - message.workerReceivedAtMs);
                const resultTransferMs = Math.max(0, receivedAtMs
                    - message.workerResultPostedAtMs);
                const accountedMs = queueMs + requestPostMs + requestTransferMs
                    + workerSetupMs + message.analyzeMs + message.encodeMs
                    + resultTransferMs + decodeMs;
                this.callbacks.onMetrics?.({
                    uri: job.input.source.uri, queueMs, requestPostMs,
                    requestTransferMs, workerSetupMs, analyzeMs: message.analyzeMs,
                    encodeMs: message.encodeMs, resultTransferMs, decodeMs,
                    otherMs: totalMs - accountedMs, totalMs
                });
                job.resolve(result);
            } catch (error) {
                job.reject(error instanceof Error ? error : new Error(String(error)));
            }
        } else {
            this.fail(new Error('Unknown analysis worker response type'));
            job.reject(this.failure!);
        }
        this.dispatch();
    }

    private rejectAll(error: Error): void {
        const active = this.active;
        this.active = undefined;
        if (active) active.reject(error);
        for (const job of this.queue.splice(0)) job.reject(error);
    }

    private fail(error: Error): void {
        if (this.disposed || this.failure) return;
        this.failure = error;
        this.rejectAll(error);
        void this.worker.terminate().catch(() => undefined);
    }
}
