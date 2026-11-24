// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AnalysisResult } from '../validation/analysisResult';
import type { AnalysisExecutionInput, AnalysisExecutor } from './analysisExecutor';

interface QueuedExecution {
    readonly input: AnalysisExecutionInput;
    readonly resolve: (value: AnalysisResult) => void;
    readonly reject: (error: Error) => void;
}

/**
 * Limits execution to a fixed set of independent AnalysisExecutor instances.
 * Each worker owns its own Validator and transport protocol. The pool owns no
 * DocumentRegistry, analysis identities, version policy, or LSP state.
 *
 * The AnalysisScheduler remains responsible for interactive prioritization.
 * This small FIFO is only backpressure if more jobs reach the pool than there
 * are free workers (for example, from a caller other than the LSP scheduler).
 */
export class WorkerPoolAnalysisExecutor implements AnalysisExecutor {
    private readonly workers: AnalysisExecutor[] = [];
    private readonly available: number[] = [];
    private readonly waiting: QueuedExecution[] = [];
    private readonly running = new Map<number, QueuedExecution>();
    private disposed = false;

    constructor(count: number, makeWorker: (index: number) => AnalysisExecutor) {
        if (!Number.isSafeInteger(count) || count < 1) {
            throw new Error('Worker pool requires a positive integer worker count');
        }
        try {
            for (let index = 0; index < count; index++) {
                this.workers.push(makeWorker(index));
                this.available.push(index);
            }
        } catch (error) {
            for (const worker of this.workers) worker.dispose?.();
            throw error;
        }
    }

    execute(input: AnalysisExecutionInput): Promise<AnalysisResult> {
        if (this.disposed) return Promise.reject(new Error('Analysis worker pool is disposed'));
        return new Promise((resolve, reject) => {
            this.waiting.push({ input, resolve, reject });
            this.dispatch();
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const error = new Error('Analysis worker pool was shut down');
        for (const job of this.waiting.splice(0)) job.reject(error);
        for (const job of this.running.values()) job.reject(error);
        this.running.clear();
        for (const worker of this.workers) worker.dispose?.();
    }

    private dispatch(): void {
        while (!this.disposed && this.available.length && this.waiting.length) {
            const index = this.available.shift()!;
            const job = this.waiting.shift()!;
            let running: Promise<AnalysisResult>;
            try {
                running = this.workers[index]!.execute(job.input);
            } catch (error) {
                job.reject(error instanceof Error ? error : new Error(String(error)));
                this.available.push(index);
                continue;
            }
            this.running.set(index, job);
            void Promise.resolve(running)
                .then(
                    result => { if (!this.disposed) job.resolve(result); },
                    error => { if (!this.disposed) job.reject(error); }
                )
                .finally(() => {
                    this.running.delete(index);
                    if (this.disposed) return;
                    this.available.push(index);
                    this.dispatch();
                });
        }
    }
}
