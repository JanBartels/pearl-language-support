// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { TextDocument } from 'vscode-languageserver-textdocument';
import { mapToOriginalLocation } from '../core/sourceOffset';
import {
    SourceHighlightAttribute,
    SourceHighlightKind,
    type SourceHighlight
} from '../semantic/sourceHighlight';
import type { TokenType, TokenModifier } from './tokenLegend';
import { TokenLegend } from './tokenLegend';

/** An LSP-compatible result; the compiler model has no dependency on LSP. */
export interface EncodedSemanticTokens {
    readonly data: number[];
}

interface PositionedToken {
    readonly start: number;
    readonly end: number;
    readonly line: number;
    readonly character: number;
    readonly tokenType: number;
    readonly modifiers: number;
}

/**
 * Converts the compiler's SourceValue classifications into Semantic Tokens.
 *
 * The mapper only emits ranges in the requested *physical* document.
 * It rejects multi-line, non-physical and ambiguous overlapping candidates;
 * source mapping is not allowed to invent highlight ranges for an expansion.
 */
export class SourceHighlightMapper {
    constructor(private readonly legend: TokenLegend) {}

    map(document: TextDocument, highlights: readonly SourceHighlight[]): EncodedSemanticTokens {
        const text = document.getText();
        const raw: PositionedToken[] = [];

        for (const highlight of highlights) {
            const element = highlight.element;
            if (!element.location) continue;

            const location = mapToOriginalLocation(element.location);
            if (location.source.uri !== document.uri) continue;
            const { start, end } = location.span;
            if (!Number.isInteger(start) || !Number.isInteger(end)
                || start < 0 || end > text.length || start >= end) continue;

            const physicalText = text.slice(start, end);
            if (/\r|\n/.test(physicalText)) continue;

            // A compiler token produced by macro expansion can map onto the
            // invocation, although the invocation spells a DIFFERENT token.
            // Do not colour that macro invocation as the generated token.
            if (element.lexicalLocation && typeof element.value === 'string'
                && physicalText !== element.value) continue;

            const position = document.positionAt(start);
            const after = document.positionAt(end);
            if (position.line !== after.line || position.character >= after.character) continue;

            raw.push({
                start,
                end,
                line: position.line,
                character: position.character,
                tokenType: this.legend.getType(this.tokenType(highlight.kind)),
                modifiers: this.legend.getModifierMask(this.modifiers(highlight.attributes))
            });
        }

        // LSP requires ascending, non-overlapping tokens. A repeated physical
        // occurrence can arise from several macro expansions or analyses.
        raw.sort((a, b) => a.start - b.start || b.end - a.end || a.tokenType - b.tokenType);
        const accepted: PositionedToken[] = [];
        let ambiguousUntil = -1;
        for (const token of raw) {
            if (token.start < ambiguousUntil) {
                ambiguousUntil = Math.max(ambiguousUntil, token.end);
                continue;
            }
            const previous = accepted[accepted.length - 1];
            if (previous && token.start < previous.end) {
                if (token.start === previous.start && token.end === previous.end
                    && token.tokenType === previous.tokenType) {
                    accepted[accepted.length - 1] = {
                        ...previous,
                        modifiers: previous.modifiers | token.modifiers
                    };
                    continue;
                }
                // A conflicting classification has no unique physical meaning.
                // Drop the whole overlapping region rather than guessing.
                accepted.pop();
                ambiguousUntil = Math.max(previous.end, token.end);
                continue;
            }
            accepted.push(token);
        }

        const data: number[] = [];
        let previousLine = 0;
        let previousCharacter = 0;
        for (const token of accepted) {
            const deltaLine = token.line - previousLine;
            const deltaStart = deltaLine === 0
                ? token.character - previousCharacter : token.character;
            data.push(deltaLine, deltaStart, token.end - token.start,
                token.tokenType, token.modifiers);
            previousLine = token.line;
            previousCharacter = token.character;
        }
        return { data };
    }

    private tokenType(kind: SourceHighlightKind): TokenType {
        switch (kind) {
            case SourceHighlightKind.Module: return 'namespace';
            case SourceHighlightKind.Type: return 'type';
            case SourceHighlightKind.DataObject: return 'variable';
            case SourceHighlightKind.Parameter: return 'parameter';
            case SourceHighlightKind.Procedure: return 'function';
            // TASK has no exact standard LSP counterpart. Its final visual
            // classification belongs to the language-specific next step.
            case SourceHighlightKind.Task: return 'class';
            case SourceHighlightKind.StructComponent: return 'property';
            case SourceHighlightKind.Label: return 'label';
            case SourceHighlightKind.Macro: return 'macro';
            case SourceHighlightKind.Keyword: return 'keyword';
            case SourceHighlightKind.Operator: return 'operator';
            case SourceHighlightKind.StringLiteral: return 'string';
            case SourceHighlightKind.NumberLiteral: return 'number';
        }
    }

    private modifiers(attributes: readonly SourceHighlightAttribute[] | undefined): TokenModifier[] {
        const result: TokenModifier[] = [];
        for (const attribute of attributes ?? []) {
            switch (attribute) {
                case SourceHighlightAttribute.Declaration:
                    result.push('declaration');
                    break;
                case SourceHighlightAttribute.Readonly:
                    result.push('readonly');
                    break;
            }
        }
        return result;
    }
}
