// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AnalysisExecutionInput } from './analysisExecutor';
import type { AnalysisResultWire } from './transport/analysisResultTransport';

/** Only snapshots and primitives cross this boundary; never DocumentRegistry or live AST. */
export type WorkerAnalysisInput = AnalysisExecutionInput & {
    readonly includeSnapshots: NonNullable<AnalysisExecutionInput['includeSnapshots']>;
};

export interface WorkerAnalyzeRequest {
    readonly type: 'analyze';
    readonly id: number;
    readonly input: WorkerAnalysisInput;
}

export interface WorkerAnalyzeResult {
    readonly type: 'result';
    readonly id: number;
    readonly wire: AnalysisResultWire;
    readonly analyzeMs: number;
    readonly encodeMs: number;
    /** Absolute monotonic timestamps (performance.timeOrigin + performance.now). */
    readonly workerReceivedAtMs: number;
    readonly workerAnalyzeStartedAtMs: number;
    /** Taken just before postMessage; includes response clone and event-loop delay. */
    readonly workerResultPostedAtMs: number;
}

export interface WorkerAnalyzeError {
    readonly type: 'error';
    readonly id: number;
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
}

export interface WorkerAnalyzeLog {
    readonly type: 'log';
    readonly id: number;
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly message: string;
}

export type WorkerAnalysisResponse =
    WorkerAnalyzeResult | WorkerAnalyzeError | WorkerAnalyzeLog;
