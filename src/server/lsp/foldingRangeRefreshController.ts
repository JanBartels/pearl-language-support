// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** A cancellable task keeps refresh coalescing independent of the host timer. */
export interface ScheduledRefresh {
    cancel(): void;
}

export type RefreshScheduler = (callback: () => void, delayMs: number) => ScheduledRefresh;

const defaultScheduler: RefreshScheduler = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return { cancel: () => clearTimeout(timer) };
};

/**
 * Folding ranges are a client-side cache. A code-lens context change does not
 * change the document version and therefore does not invalidate that cache.
 *
 * workspace/foldingRange/refresh is an LSP 3.18 request. Only send it when
 * the client advertises workspace.foldingRange.refreshSupport.
 *
 * The refresh is global. Coalesce requests from parallel translation-unit
 * analyses so opening a folder doesn't generate one refresh per module.
 */
export class FoldingRangeRefreshController {
    private supported = false;
    private pending: ScheduledRefresh | undefined;

    constructor(
        private readonly requestRefresh: () => Promise<unknown>,
        private readonly onFailure: (error: unknown) => void,
        private readonly scheduler: RefreshScheduler = defaultScheduler,
        private readonly delayMs = 75
    ) {}

    setSupported(supported: boolean): void {
        this.supported = supported;
        if (!supported) this.cancelPending();
    }

    schedule(): void {
        if (!this.supported || this.pending) return;
        this.pending = this.scheduler(() => {
            this.pending = undefined;
            try {
                void this.requestRefresh().catch(error => this.onFailure(error));
            } catch (error) {
                this.onFailure(error);
            }
        }, this.delayMs);
    }

    dispose(): void {
        this.setSupported(false);
    }

    private cancelPending(): void {
        this.pending?.cancel();
        this.pending = undefined;
    }
}
