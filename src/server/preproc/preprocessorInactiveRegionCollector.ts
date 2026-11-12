// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { Source } from '../source/source';
import type { PreprocessorConditionalBlockCollection } from './preprocessorConditionalBlockCollection';

/**
 * Editor-visible inactive source ranges, derived from preprocessor metadata.
 *
 * Only complete conditional blocks are considered. Nested disabled branches
 * are coalesced, so the editor receives one diagnostic per contiguous region.
 * Directive lines delimiting the region stay active for Hover/navigation.
 */
export class PreprocessorInactiveRegionCollector {
    collect(blocks: PreprocessorConditionalBlockCollection): readonly Location[] {
        const bySource = new Map<Source, { start: number; end: number }[]>();

        for (const block of blocks) {
            const startDirective = block.conditionSatisfied
                ? block.elseLocation
                : block.ifLocation;
            if (!startDirective) continue;
            const endDirective = block.conditionSatisfied
                ? block.endifLocation
                : block.elseLocation ?? block.endifLocation;

            // Cross-source ranges cannot be represented by a single Location.
            if (startDirective.source !== endDirective.source) continue;
            const source = startDirective.source;
            const start = this.afterDirectiveLine(source.text, startDirective.span.end);
            const end = this.lineStart(source.text, endDirective.span.start);
            if (end <= start || source.getText({ start, end }).trim().length === 0) continue;

            let spans = bySource.get(source);
            if (!spans) {
                spans = [];
                bySource.set(source, spans);
            }
            spans.push({ start, end });
        }

        const result: Location[] = [];
        for (const [source, spans] of bySource) {
            spans.sort((a, b) => a.start - b.start || a.end - b.end);
            let current: { start: number; end: number } | undefined;
            for (const span of spans) {
                if (current && span.start <= current.end) {
                    current.end = Math.max(current.end, span.end);
                } else {
                    current = { ...span };
                    result.push({ source, span: current });
                }
            }
        }
        return result;
    }

    private afterDirectiveLine(text: string, offset: number): number {
        const newline = text.indexOf('\n', offset);
        return newline === -1 ? text.length : newline + 1;
    }

    private lineStart(text: string, offset: number): number {
        return text.lastIndexOf('\n', offset - 1) + 1;
    }
}
