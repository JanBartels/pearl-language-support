// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { ConstantFixedExpressionNode } from '../ast/problem/expressions/constantFixedExpressionNode';
import type { ConstantFixedFactorNode } from '../ast/problem/expressions/constantFixedFactorNode';
import type { ConstantFixedTermNode } from '../ast/problem/expressions/constantFixedTermNode';
import type { DyadicExpressionNode } from '../ast/problem/expressions/dyadicExpressionNode';
import type { MonadicExpressionNode } from '../ast/problem/expressions/monadicExpressionNode';
import type { SignedConstantExpressionNode } from '../ast/problem/expressions/signedConstantExpressionNode';
import type { SourceValue } from '../core/sourceValue';
import { SourceHighlightKind, type SourceHighlight } from './sourceHighlight';
import type { SemanticContext } from './semanticContext';

/**
 * Highlights operators whose role is established by the parsed grammar or
 * explicitly by the semantic resolver. Unlike a lexical word list, this does
 * not mistake a user-defined ABS(...) procedure for an intrinsic operator.
 *
 * Other keywords and literals retain their existing TextMate highlighting;
 * they do not need a redundant semantic classification.
 */
export class OperatorHighlightCollector {
    collect(root: AstNode, semantic: SemanticContext): readonly SourceHighlight[] {
        const highlights: SourceHighlight[] = [];
        const seen = new Set<SourceValue<string>>();

        const add = (element: SourceValue<string> | undefined): void => {
            if (!element?.location || seen.has(element)) return;
            seen.add(element);
            highlights.push({ element, kind: SourceHighlightKind.Operator });
        };

        const visit = (node: AstNode): void => {
            switch (node.kind) {
                case AstKind.MonadicExpression:
                    add((node as MonadicExpressionNode).operator);
                    break;
                case AstKind.DyadicExpression:
                    add((node as DyadicExpressionNode).operator);
                    break;
                case AstKind.ConstantFixedExpression:
                    for (const tail of (node as ConstantFixedExpressionNode).tails) add(tail.operator);
                    break;
                case AstKind.ConstantFixedTerm:
                    for (const tail of (node as ConstantFixedTermNode).tails) add(tail.operator);
                    break;
                case AstKind.ConstantFixedFactor:
                    add((node as ConstantFixedFactorNode).sign);
                    break;
                case AstKind.SignedConstantExpression:
                    add((node as SignedConstantExpressionNode).sign);
                    break;
            }
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);

        // Parenthesized ambiguous spellings such as ABS(X) remain a neutral
        // NameExpression in the AST. Only the semantic resolver can say that
        // this occurrence is an operator rather than a procedure invocation.
        for (const operator of semantic.monadicOperatorBindings) add(operator);

        return highlights;
    }
}
