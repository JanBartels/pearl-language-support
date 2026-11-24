// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { performance } from 'node:perf_hooks';
import { Logger } from './logger';

/**
 * Temporary lifecycle instrumentation for the Linux F5 reproduction.
 * Log events carry both wall-clock time and elapsed monotonic time.
 * No changes to the dependency graph, request validity or scheduling.
 */
export class AnalysisTrace {
    private readonly startedAt = performance.now();
    private sequence = 0;
    readonly enabled = process.env.PEARL_ANALYSIS_TRACE !== '0';

    constructor(private readonly logger: Logger) {}

    event(name: string, attributes: Record<string, unknown> = {}): void {
        if (!this.enabled) return;
        const sequence = String(++this.sequence).padStart(5, '0');
        const elapsed = (performance.now() - this.startedAt).toFixed(1);
        this.logger.debug?.(
            `[AnalysisTrace] ${new Date().toISOString()} +${elapsed}ms #${sequence} `
            + `${name} ${JSON.stringify(attributes)}`
        );
    }

    now(): number {
        return performance.now();
    }
}
