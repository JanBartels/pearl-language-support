// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * LSP-side scheduling for complete translation units. No compiler or
 * DocumentRegistry state is owned here; request identities belong to the
 * registry, and the caller alone decides whether an analysis is still valid.
 */
export type AnalysisPriority = 'interactive' | 'background';

export interface AnalysisRequest {
    readonly rootUri: string;
    readonly requestId: number;
    readonly trigger: string;
    readonly priority: AnalysisPriority;
}

export interface ScheduledAnalysisTask {
    cancel(): void;
}

/** Injected time source makes coalescing and priority ordering testable. */
export interface AnalysisSchedulerTiming {
    now(): number;
    delay(callback: () => void, delayMs: number): ScheduledAnalysisTask;
    defer(callback: () => void): ScheduledAnalysisTask;
}

const defaultTiming: AnalysisSchedulerTiming = {
    now: () => Date.now(),
    delay: (callback, ms) => {
        const timer = setTimeout(callback, ms);
        return { cancel: () => clearTimeout(timer) };
    },
    defer: callback => {
        // Unlike a Promise/microtask chain this returns control to the LSP
        // event loop between successive translation units.
        const immediate = setImmediate(callback);
        return { cancel: () => clearImmediate(immediate) };
    }
};

interface PendingAnalysis {
    readonly request: AnalysisRequest;
    readonly readyAt: number;
    readonly order: number;
}

export interface AnalysisQueueResult {
    readonly replaced: boolean;
    readonly pendingCount: number;
    readonly effectivePriority: AnalysisPriority;
}

/**
 * At most maxConcurrent independent translation units at a time. Replacing a pending request keeps
 * only the newest requestId and extends a trailing-edge debounce interval.
 *
 * No two requests for the same root run simultaneously, even when a root is
 * invalidated and requeued while its earlier analysis is still in flight.
 * The scheduler cannot preempt a running synchronous Validator. With workers
 * it awaits results without blocking the event loop.
 * The scheduler does not depend on the selected executor implementation.
 */
export class AnalysisScheduler {
    private readonly pending = new Map<string, PendingAnalysis>();
    private nextOrder = 0;
    private wakeup: ScheduledAnalysisTask | undefined;
    private readonly runningRoots = new Set<string>();
    private disposed = false;

    constructor(
        private readonly execute: (request: AnalysisRequest) => Promise<void>,
        private readonly isCurrent: (request: AnalysisRequest) => boolean,
        private readonly onError: (error: unknown, request: AnalysisRequest) => void,
        private readonly timing: AnalysisSchedulerTiming = defaultTiming,
        private readonly onActivityChange?: (active: boolean) => void,
        private readonly maxConcurrent = 1
    ) {
        if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) {
            throw new Error('AnalysisScheduler requires a positive integer concurrency limit');
        }
    }

    private active = false;

    private reportActivity(): void {
        const active = this.runningRoots.size > 0 || this.pending.size > 0;
        if (active === this.active) return;
        this.active = active;
        this.onActivityChange?.(active);
    }

    /**
     * A new request for a root supersedes its queued predecessor. An existing
     * interactive priority is not downgraded by a later background event.
     * The caller invalidates/begins the request in DocumentRegistry *before*
     * calling this method, including when an analysis is already running.
     */
    enqueue(request: AnalysisRequest, debounceMs = 0): AnalysisQueueResult {
        if (this.disposed) {
            return { replaced: false, pendingCount: 0, effectivePriority: request.priority };
        }
        const previous = this.pending.get(request.rootUri);
        const priority: AnalysisPriority = previous?.request.priority === 'interactive'
            ? 'interactive' : request.priority;
        // A later background notification should not remove the debounce
        // window for a pending interactive change.
        const delayMs = Math.max(0, debounceMs, priority === 'interactive'
            ? Math.max(0, (previous?.readyAt ?? 0) - this.timing.now()) : 0);
        this.pending.set(request.rootUri, {
            request: { ...request, priority },
            readyAt: this.timing.now() + delayMs,
            order: ++this.nextOrder
        });
        this.reportActivity();
        this.planNext();
        return {
            replaced: previous !== undefined,
            pendingCount: this.pending.size,
            effectivePriority: priority
        };
    }

    /** Remove queued work when a translation unit ceases to be active. */
    cancel(rootUri: string): void {
        if (this.pending.delete(rootUri)) {
            this.reportActivity();
            this.planNext();
        }
    }

    /** Prevent later queued work, e.g. after LSP shutdown. */
    dispose(): void {
        this.disposed = true;
        this.wakeup?.cancel();
        this.wakeup = undefined;
        this.pending.clear();
        this.reportActivity();
    }

    private chooseReady(now: number): PendingAnalysis | undefined {
        const runnable = [...this.pending.values()]
            .filter(entry => !this.runningRoots.has(entry.request.rootUri));
        const interactive = runnable
            .filter(entry => entry.request.priority === 'interactive');
        const interactiveReady = interactive.filter(entry => entry.readyAt <= now)
            .sort((left, right) => left.order - right.order);
        if (interactiveReady.length > 0) return interactiveReady[0];
        // An interactive document waiting for its short debounce takes
        // precedence over starting a potentially long background validator.
        if (interactive.length > 0) return undefined;
        return runnable
            .filter(entry => entry.readyAt <= now)
            .sort((left, right) => left.order - right.order)[0];
    }

    private planNext(): void {
        this.wakeup?.cancel();
        this.wakeup = undefined;
        if (this.disposed || this.runningRoots.size >= this.maxConcurrent || this.pending.size === 0) return;
        const now = this.timing.now();
        const ready = this.chooseReady(now);
        if (ready) {
            this.wakeup = this.timing.defer(() => {
                this.wakeup = undefined;
                void this.runNext();
            });
            return;
        }
        const future = [...this.pending.values()]
            .filter(entry => !this.runningRoots.has(entry.request.rootUri) && entry.readyAt > now);
        if (future.length === 0) return;
        const earliest = Math.min(...future.map(entry => entry.readyAt));
        this.wakeup = this.timing.delay(() => {
            this.wakeup = undefined;
            this.planNext();
        }, Math.max(1, earliest - now));
    }

    private async runNext(): Promise<void> {
        if (this.disposed || this.runningRoots.size >= this.maxConcurrent) return;
        const entry = this.chooseReady(this.timing.now());
        if (!entry) {
            this.planNext();
            return;
        }
        this.pending.delete(entry.request.rootUri);
        // Supersession and closing are decided by DocumentRegistry, not by
        // comparing scheduler-local copies of document versions.
        if (!this.isCurrent(entry.request)) {
            this.reportActivity();
            this.planNext();
            return;
        }
        this.runningRoots.add(entry.request.rootUri);
        this.reportActivity();
        // Fill remaining slots, yielding to the event loop between dispatches.
        this.planNext();
        try {
            await this.execute(entry.request);
        } catch (error) {
            this.onError(error, entry.request);
        } finally {
            this.runningRoots.delete(entry.request.rootUri);
            this.reportActivity();
            // Always yield to the event loop before running the next unit.
            this.planNext();
        }
    }
}
