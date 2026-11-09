// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import type { FormatItemNode } from '../ast/problem/statements/formatItemNode';
import type { FormatListNode } from '../ast/problem/statements/formatListNode';
import type { FormatReferenceNode } from '../ast/problem/statements/formatReferenceNode';

/** One frame represents a format list, never an expanded copy of it. */
interface ListFrame {
    readonly list: FormatListNode;
    index: number;
    remaining: bigint;
    /** Identify active FORMAT declarations by their AST, not by their name. */
    readonly activeReferences: readonly FormatListNode[];
}

interface PendingFormat {
    readonly item: FormatItemNode;
    remaining: bigint;
}

type CursorResult =
    | { readonly kind: 'format'; readonly item: FormatItemNode }
    | { readonly kind: 'end' }
    | { readonly kind: 'unknown' };

interface RestartPoint {
    readonly frames: readonly ListFrame[];
    readonly group: FormatListNode;
    readonly count: bigint;
    readonly activeReferences: readonly FormatListNode[];
}

/**
 * Lazy interpreter for RTOS-UH 5.5.6-5.5.9.
 *
 * Non-consuming formats are returned to the caller as ordinary items. The
 * caller determines which of them consume data; this cursor knows no types.
 *
 * If a format pass ends with data left, RTOS-UH resumes at the last entered
 * block repetition group (including groups in R declarations), otherwise at
 * the beginning. A restart retains the containing lists and their suffixes.
 */
export class FormatExecutionCursor {
    private frames: ListFrame[];
    private pending: PendingFormat | undefined;
    private lastBlock: RestartPoint | undefined;
    private steps = 0;
    private readonly identities = new WeakMap<object, number>();
    private identityCount = 0;

    constructor(
        private readonly root: FormatListNode,
        private readonly evaluateCount: (expression: ExpressionNode) => bigint | undefined,
        private readonly resolveReference: (reference: FormatReferenceNode) => FormatListNode | undefined,
        private readonly isNonConsuming?: (item: FormatItemNode) => boolean
    ) {
        this.frames = [this.frame(root, 1n, [])];
    }

    next(): CursorResult {
        // Unknown means insufficient information, not an invalid program.
        // The guard also prevents unbounded runs of non-consuming formats.
        while (++this.steps <= 50000) {
            if (this.pending) {
                const item = this.pending.item;
                if (--this.pending.remaining === 0n) this.pending = undefined;
                return { kind: 'format', item };
            }
            const top = this.frames[this.frames.length - 1];
            if (!top) return { kind: 'end' };
            if (top.index >= top.list.items.length) {
                if (--top.remaining > 0n) top.index = 0;
                else this.frames.pop();
                continue;
            }
            const item = top.list.items[top.index++];
            const repeat = item.repeatCount ? this.evaluateCount(item.repeatCount) : 1n;
            if (repeat === undefined || repeat < 0n) return { kind: 'unknown' };
            if (repeat === 0n) continue;
            if (item.group) {
                this.lastBlock = {
                    frames: this.frames.map(frame => ({ ...frame })),
                    group: item.group,
                    count: repeat,
                    activeReferences: top.activeReferences
                };
                // A block consisting solely of direct control formats has no
                // data effect. Even a huge repetition may be skipped, but its
                // restart point must be preserved for an implicit rewind.
                if (this.hasOnlyDirectControls(item.group)) continue;
                this.frames.push(this.frame(item.group, repeat, top.activeReferences));
                continue;
            }
            if (item.reference) {
                const referred = this.resolveReference(item.reference);
                if (!referred || top.activeReferences.includes(referred)
                    || top.activeReferences.length >= 3) return { kind: 'unknown' };
                // R(...) containing only controls and no block repetitions
                // cannot consume data or change the implicit restart point.
                // Skip *all* its repetitions instead of exhausting the guard.
                if (this.hasOnlyControlsWithoutBlocks(referred,
                    [...top.activeReferences, referred])) continue;
                this.frames.push(this.frame(referred, repeat,
                    [...top.activeReferences, referred]));
                continue;
            }
            this.pending = { item, remaining: repeat };
        }
        return { kind: 'unknown' };
    }

    /**
     * Skip a run consisting of exactly the same format item. For consuming
     * formats the caller may only skip homogeneous data elements; for
     * non-consuming controls it can omit the maximum entirely. A run never
     * crosses other format items or R calls. Returns executions skipped.
     */
    skipIdenticalFormats(item: FormatItemNode, maximum?: bigint): bigint {
        if (maximum !== undefined && maximum <= 0n) return 0n;
        let skipped = 0n;
        if (this.pending?.item === item) {
            const amount = maximum !== undefined && maximum < this.pending.remaining
                ? maximum : this.pending.remaining;
            this.pending.remaining -= amount;
            if (this.pending.remaining === 0n) this.pending = undefined;
            skipped += amount;
        }
        // A block with exactly one data-consuming format and otherwise only
        // direct controls (e.g. F,X or X,(2)F,SKIP) is homogeneous as far as
        // data pairing is concerned. Skip its *whole* repetitions without
        // traversing controls or duplicating syntax nodes. The lastBlock marker
        // is unchanged because there are no nested blocks in this list.
        const top = this.frames[this.frames.length - 1];
        const currentIndex = top ? top.index - 1 : -1;
        const homogeneous = top && top.list.items[currentIndex] === item
            && top.list.items.every((candidate, index) => index === currentIndex
                || (!!candidate.keyword && !candidate.group && !candidate.reference
                    && !!this.isNonConsuming?.(candidate)));
        if ((maximum === undefined || skipped < maximum)
            && !this.pending && top && homogeneous && top.remaining > 1n) {
            const innerCount = item.repeatCount ? this.evaluateCount(item.repeatCount) : 1n;
            if (innerCount !== undefined && innerCount > 0n) {
                const availableGroups = top.remaining - 1n;
                const left = maximum === undefined ? availableGroups * innerCount : maximum - skipped;
                const groups = left / innerCount < availableGroups
                    ? left / innerCount : availableGroups;
                top.remaining -= groups;
                skipped += groups * innerCount;
            }
        }
        return skipped;
    }

    /**
     * State fingerprint for recognizing complete cycles of a format cursor.
     * Deliberately excludes the work budget: identical states yield identical
     * future formats, including the position of the next implicit restart.
     */
    stateKey(): string {
        const frameKey = (frame: ListFrame): string =>
            `${this.id(frame.list)}:${frame.index}:${frame.remaining}:` +
            frame.activeReferences.map(reference => this.id(reference)).join('.');
        const frames = this.frames.map(frameKey).join('/');
        const pending = this.pending
            ? `${this.id(this.pending.item)}:${this.pending.remaining}` : '-';
        const last = this.lastBlock
            ? `${this.id(this.lastBlock.group)}:${this.lastBlock.count}:` +
              this.lastBlock.frames.map(frameKey).join('/') + ':' +
              this.lastBlock.activeReferences.map(ref => this.id(ref)).join('.')
            : '-';
        return `${frames}|${pending}|${last}`;
    }

    /** Only call when further data remain after the format pass ended. */
    restart(): void {
        this.pending = undefined;
        if (!this.lastBlock) {
            this.frames = [this.frame(this.root, 1n, [])];
            return;
        }
        const point = this.lastBlock;
        this.frames = point.frames.map(frame => ({ ...frame }));
        this.frames.push(this.frame(point.group, point.count, point.activeReferences));
    }

    /**
     * Conservative proof that a list produces only controls and does not
     * update the implicit restart point. Recursive R references are allowed;
     * repeated groups are deliberately excluded because they are restart
     * candidates even if they contain only controls.
     */
    private hasOnlyControlsWithoutBlocks(list: FormatListNode,
        active: readonly FormatListNode[]): boolean {
        if (!this.isNonConsuming) return false;
        for (const item of list.items) {
            if (item.group) return false;
            if (item.reference) {
                const target = this.resolveReference(item.reference);
                if (!target || active.includes(target) || active.length >= 3
                    || !this.hasOnlyControlsWithoutBlocks(target, [...active, target])) return false;
            } else if (!item.keyword || !this.isNonConsuming(item)) return false;
        }
        return true;
    }

    private hasOnlyDirectControls(list: FormatListNode): boolean {
        return !!this.isNonConsuming && list.items.every(item =>
            !item.group && !item.reference && !!item.keyword && this.isNonConsuming!(item));
    }

    private id(value: object): number {
        const known = this.identities.get(value);
        if (known !== undefined) return known;
        const id = ++this.identityCount;
        this.identities.set(value, id);
        return id;
    }

    private frame(list: FormatListNode, count: bigint,
        references: readonly FormatListNode[]): ListFrame {
        return { list, index: 0, remaining: count, activeReferences: references };
    }
}
