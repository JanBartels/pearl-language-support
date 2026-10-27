// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { NamedTypeNode } from '../ast/problem/types/namedTypeNode';
import type { ProcedureSpecificationParameterNode }
    from '../ast/problem/procedures/procedureSpecificationParameterNode';
import { SourceValue } from '../core/sourceValue';
import type { Source } from '../source/source';
import type { CommentToken } from '../lexer/token';
import { CommentKind } from '../lexer/token';
import { isValidPearlIdentifier } from '../lexer/pearlIdentifier';

export interface DocumentaryParameterName {
    readonly name: SourceValue<string>;
    readonly origin: 'comment';
}

/**
 * Conservative association of active block comments with *unnamed* formal
 * parameters in SPC ENTRY and REF PROC signatures. Neither syntax nor semantic
 * types are modified, and this phase never emits diagnostics.
 *
 * Each Source is indexed by its own identity rather than by URI or mapped
 * offset. This prevents an unrelated include or macro expansion from lending
 * its comment to a parameter in another token stream.
 */
export class ProcedureParameterDocumentationCollector {
    private readonly commentsBySource = new Map<Source, readonly CommentToken[]>();

    constructor(comments: readonly CommentToken[]) {
        const grouped = new Map<Source, CommentToken[]>();
        for (const comment of comments) {
            if (comment.commentKind !== CommentKind.Block) continue;
            const source = comment.location.source;
            const items = grouped.get(source) ?? [];
            if (!grouped.has(source)) grouped.set(source, items);
            items.push(comment);
        }
        for (const [source, items] of grouped) {
            items.sort((a, b) => a.location.span.end - b.location.span.end);
            this.commentsBySource.set(source, items);
        }
    }

    nameFor(parameter: ProcedureSpecificationParameterNode): DocumentaryParameterName | undefined {
        // Real names take precedence and are handled by CallSignatureIndex.
        if (parameter.name) return undefined;
        const firstTypeToken = parameter.type instanceof NamedTypeNode
            ? parameter.type.name : parameter.type.keyword;
        const location = firstTypeToken.location;
        if (!location) return undefined;

        const comments = this.commentsBySource.get(location.source);
        if (!comments?.length) return undefined;

        // Find the closest preceding comment in exactly this Source.
        let lo = 0;
        let hi = comments.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (comments[mid].location.span.end <= location.span.start) lo = mid + 1;
            else hi = mid;
        }
        if (lo === 0) return undefined;
        const candidate = comments[lo - 1];
        const between = location.source.getText({
            start: candidate.location.span.end,
            end: location.span.start
        });
        // The comment must immediately precede the type: nothing but whitespace.
        if (!/^\s*$/.test(between)) return undefined;

        const text = location.source.getText(candidate.location.span);
        const match = /^\/\*\s*([A-Za-z][A-Za-z0-9_]*)\s*\*\/$/.exec(text);
        if (!match || !isValidPearlIdentifier(match[1])) return undefined;
        const name = match[1];
        const start = candidate.location.span.start + text.indexOf(name);
        return {
            name: new SourceValue(name, {
                source: location.source, span: { start, end: start + name.length }
            }),
            origin: 'comment'
        };
    }
}
