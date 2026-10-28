// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { SourceValue } from '../core/sourceValue';
import type { ShellCommandNode } from '../ast/module/shellCommandNode';
import type { InitElementNode } from '../ast/problem/declarations/initElementNode';
import type { DclDationAttributeNode } from '../ast/problem/declarations/dclDationAttributeNode';
import type { ConstantFixedFactorNode } from '../ast/problem/expressions/constantFixedFactorNode';
import type { NamedTypeNode } from '../ast/problem/types/namedTypeNode';
import type { NameSegmentNode } from '../ast/problem/expressions/nameSegmentNode';
import type { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import type { GotoStatementNode } from '../ast/problem/statements/gotoStatementNode';
import type { BlockNode } from '../ast/problem/statements/blockNode';
import type { RepetitionNode } from '../ast/problem/statements/repetitionNode';
import type { SymbolReference } from './symbolReference';
import { SymbolReferenceKind } from './symbolReference';
import { SymbolReferenceIndex } from './symbolReferenceIndex';

/**
 * Extracts symbol usages from the AST without consulting scope or bindings.
 *
 * Only grammatical name occurrences are registered. Raw expression token
 * sequences in as-yet-unparsed statements are deliberately excluded.
 * Structured expression names are references, including each component;
 * their interpretation comes only from semantic bindings.
 *
 * Declaration names (DCL, TYPE, PROC, TASK, parameters, labels, SPC) are
 * not references merely because they are SourceValue<string> objects.
 */
export class SymbolReferenceCollector {
    collect(root: AstNode): SymbolReferenceIndex {
        const references: SymbolReference[] = [];
        const seen = new Set<SourceValue<string>>();

        const add = (
            node: AstNode,
            identifier: SourceValue<string> | undefined,
            kind: SymbolReferenceKind
        ): void => {
            // Parser recovery may create artificial identifiers without a source
            // position. They are not editable symbol occurrences.
            if (!identifier?.location || seen.has(identifier)) {
                return;
            }
            seen.add(identifier);
            references.push({ node, identifier, kind });
        };

        const visit = (node: AstNode): void => {
            switch (node.kind) {
                case AstKind.NameSegment:
                    add(node, (node as NameSegmentNode).identifier, SymbolReferenceKind.Read);
                    break;

                case AstKind.NamedType:
                    add(node, (node as NamedTypeNode).name, SymbolReferenceKind.Type);
                    break;

                case AstKind.ConstantFixedFactor: {
                    const factor = node as ConstantFixedFactorNode;
                    if (factor.operand.kind === 'identifier') {
                        add(node, factor.operand.identifier, SymbolReferenceKind.Read);
                    }
                    break;
                }

                case AstKind.DclDationAttribute:
                    add(node, (node as DclDationAttributeNode).systemDation,
                        SymbolReferenceKind.DationCreationSource);
                    break;

                case AstKind.InitElement: {
                    const initializer = (node as InitElementNode).value;
                    if (initializer.kind === 'identifier') {
                        add(node, initializer.identifier, SymbolReferenceKind.Initialization);
                    }
                    break;
                }

                case AstKind.CallStatement:
                    add(node, (node as CallStatementNode).target, SymbolReferenceKind.Call);
                    break;

                case AstKind.GotoStatement:
                    add(node, (node as GotoStatementNode).target, SymbolReferenceKind.JumpTarget);
                    break;

                case AstKind.ShellCommand:
                    add(node, (node as ShellCommandNode).procedureName, SymbolReferenceKind.ShellEntryPoint);
                    break;

                case AstKind.Block:
                    add(node, (node as BlockNode).endIdentifier, SymbolReferenceKind.BlockEnd);
                    break;

                case AstKind.Repetition:
                    add(node, (node as RepetitionNode).endIdentifier, SymbolReferenceKind.RepetitionEnd);
                    break;
            }

            for (const child of node.getChildren()) {
                visit(child);
            }
        };

        visit(root);
        return new SymbolReferenceIndex(references);
    }
}
