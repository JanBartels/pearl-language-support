// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** A timer abstraction allows deterministic tests without real delays. */
export interface ScheduledCodeLensRefresh {
    cancel(): void;
}

export type CodeLensRefreshScheduler = (
    callback: () => void,
    delayMs: number
) => ScheduledCodeLensRefresh;

const defaultScheduler: CodeLensRefreshScheduler = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return { cancel: () => clearTimeout(timer) };
};

/**
 * The include context CodeLens depends on analyses of several translation
 * units. During a rebuild, these results become available one after another.
 *
 * Workspace CodeLens refresh requests are global. Coalesce bursts and, if a
 * newer analysis completes while a refresh request is still running, issue a
 * follow-up refresh after its acknowledgement. This prevents an older refresh
 * from being the last one observed by the editor.
 *
 * The controller owns only LSP presentation updates. It neither changes the
 * include dependency graph nor decides which analyses are current.
 */
export class CodeLensRefreshController {
    private supported = false;
    private disposed = false;
    private pending: ScheduledCodeLensRefresh | undefined;
    private inFlight = false;
    private dirty = false;
    /** Distinguish an explicit selection from a pending analysis-only refresh. */
    private dirtyFromUser = false;
    private analysisBusy = false;
    private deferredAnalysis = false;

    constructor(
        private readonly requestRefresh: () => Promise<unknown>,
        private readonly onFailure: (error: unknown) => void,
        private readonly scheduler: CodeLensRefreshScheduler = defaultScheduler,
        private readonly delayMs = 100
    ) {}

    setSupported(supported: boolean): void {
        if (this.disposed) return;
        this.supported = supported;
        if (!supported) {
            this.pending?.cancel();
            this.pending = undefined;
            this.dirty = false;
            this.dirtyFromUser = false;
            this.deferredAnalysis = false;
        }
    }

    /**
     * The scheduler owns the analysis-batch boundary. Defer only analysis-
     * driven refreshes until it becomes idle; explicit user selections must
     * still be able to request an immediate refresh during a long rebuild.
     */
    setAnalysisBusy(busy: boolean): void {
        if (this.disposed) return;
        // A new batch may start during the previous batch's 100-ms timer.
        // Fold a not-yet-sent analysis-only refresh into the new batch.
        if (busy && this.dirty && !this.dirtyFromUser) {
            this.pending?.cancel();
            this.pending = undefined;
            this.dirty = false;
            this.deferredAnalysis = true;
        }
        this.analysisBusy = busy;
        if (!busy && this.deferredAnalysis) {
            this.deferredAnalysis = false;
            this.scheduleAnalysis();
        }
    }

    /** An analysis commit or include-version adoption changed the context. */
    scheduleAnalysis(): void {
        if (!this.supported || this.disposed) return;
        if (this.analysisBusy) {
            this.deferredAnalysis = true;
            return;
        }
        this.markDirty(false);
    }

    /** Called whenever a user action may change a visible CodeLens. */
    schedule(): void {
        this.markDirty(true);
    }

    private markDirty(fromUser: boolean): void {
        if (!this.supported || this.disposed) return;
        this.dirty = true;
        this.dirtyFromUser ||= fromUser;
        // Do not send overlapping global refresh requests. A later update
        // remains dirty until the in-flight request has completed.
        if (this.inFlight) return;
        this.queueRefresh();
    }

    dispose(): void {
        this.supported = false;
        this.disposed = true;
        this.dirty = false;
        this.dirtyFromUser = false;
        this.deferredAnalysis = false;
        this.pending?.cancel();
        this.pending = undefined;
    }

    private queueRefresh(): void {
        // Trailing-edge scheduling: requests do not interrupt a burst of
        // translation-unit analysis completions.
        this.pending?.cancel();
        this.pending = this.scheduler(() => {
            this.pending = undefined;
            this.flush();
        }, this.delayMs);
    }

    private flush(): void {
        if (!this.supported || this.disposed || !this.dirty || this.inFlight) return;
        this.dirty = false;
        this.dirtyFromUser = false;
        this.inFlight = true;
        let request: Promise<unknown>;
        try {
            request = this.requestRefresh();
        } catch (error) {
            request = Promise.reject(error);
        }
        void Promise.resolve(request)
            .catch(error => this.onFailure(error))
            .finally(() => {
                this.inFlight = false;
                if (this.supported && !this.disposed && this.dirty) {
                    this.queueRefresh();
                }
            });
    }
}
