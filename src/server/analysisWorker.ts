// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Validator } from './validation/validator';
import { SnapshotIncludeSourceResolver } from './utility/snapshotIncludeSourceResolver';
import { encodeAnalysisResult } from './utility/transport/analysisResultTransport';
import type { Logger } from './utility/logging/logger';
import type { WorkerAnalyzeRequest, WorkerAnalysisResponse } from './utility/analysisWorkerProtocol';

if (!parentPort) throw new Error('PEARL analysis worker requires a parent port');
const port = parentPort;
let busy = false;

const publish = (message: WorkerAnalysisResponse): void => port.postMessage(message);

function workerLogger(id: number): Logger {
    return {
        debug: message => publish({ type: 'log', id, level: 'debug', message }),
        info: message => publish({ type: 'log', id, level: 'info', message }),
        warn: message => publish({ type: 'log', id, level: 'warn', message }),
        error: message => publish({ type: 'log', id, level: 'error', message })
    };
}

/** Worker knows only the closed-world input. No DocumentRegistry or LSP connection. */
async function analyze(request: WorkerAnalyzeRequest, workerReceivedAtMs: number): Promise<void> {
    if (busy) throw new Error('Concurrent requests are not supported by this single worker');
    busy = true;
    try {
        const { source, settings, includeSnapshots } = request.input;
        if (!includeSnapshots || !Array.isArray(includeSnapshots.sources)
            || !Array.isArray(includeSnapshots.resolutions)) {
            throw new Error('Worker requires a complete include snapshot');
        }
        const document = TextDocument.create(source.uri, source.languageId, source.version, source.text);
        const resolver = new SnapshotIncludeSourceResolver(source, includeSnapshots);
        const validator = new Validator(workerLogger(request.id));
        const start = performance.now();
        const workerAnalyzeStartedAtMs = performance.timeOrigin + start;
        const result = await validator.analyze(document, settings, resolver);
        const analyzeMs = performance.now() - start;
        const encodeStart = performance.now();
        const wire = encodeAnalysisResult(result);
        const encodeMs = performance.now() - encodeStart;
        const workerResultPostedAtMs = performance.timeOrigin + performance.now();
        publish({
            type: 'result', id: request.id, wire, analyzeMs, encodeMs,
            workerReceivedAtMs, workerAnalyzeStartedAtMs, workerResultPostedAtMs
        });
    } finally {
        busy = false;
    }
}

port.on('message', (message: WorkerAnalyzeRequest) => {
    const workerReceivedAtMs = performance.timeOrigin + performance.now();
    if (message?.type !== 'analyze' || !Number.isSafeInteger(message.id) || message.id < 1) {
        throw new Error('Invalid analysis worker request');
    }
    void analyze(message, workerReceivedAtMs).catch((error: unknown) => {
        const problem = error instanceof Error ? error : new Error(String(error));
        publish({
            type: 'error', id: message.id, name: problem.name,
            message: problem.message,
            ...(problem.stack === undefined ? {} : { stack: problem.stack })
        });
    });
});
