// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { AssignmentNode } from '../ast/problem/statements/assignmentNode';
import type { SourceValue } from '../core/sourceValue';
import { classifyBoundNameExpressionInfo } from './expressionObject';
import type { SemanticSymbol } from './symbol';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';

/** Evaluates effective write protection at bound name occurrences.
 * This is compiler information, independent of the editor and of LSP.
 * A dereference crosses an object boundary: INV REF protects the pointer,
 * REF INV protects its target. Do not propagate the former onto the latter.
 */
export class NameAccessProtectionCollector {
    collect(
        root: AstNode,
        bindings: ReadonlyMap<SourceValue<string>, SemanticSymbol>,
        resolveType: (type: SemanticType) => SemanticType | undefined
    ): ReadonlyMap<SourceValue<string>, boolean> {
        const protection = new Map<SourceValue<string>, boolean>();

        const visit = (node: AstNode): void => {
            if (node.kind === AstKind.NameExpression) {
                const name = node as NameExpressionNode;
                const first = name.segments[0];
                const symbol = first && bindings.get(first.identifier);
                if (symbol) {
                    const info = classifyBoundNameExpressionInfo(name, symbol, resolveType);
                    if (info.category === 'object') {
                        for (const segment of info.segments) {
                            // A malformed or unresolved component must not
                            // acquire a misleading semantic classification.
                            if (bindings.has(segment.identifier)) {
                                protection.set(segment.identifier, segment.assignmentProtected);
                            }
                        }
                        // CONT on an assignment writes through the final
                        // pointer. Mark a protected target in addition to the
                        // pointer's own INV attribute; the latter must remain
                        // visible even when the target can be modified.
                        const assignment = node.parent;
                        if (assignment?.kind === AstKind.Assignment
                            && (assignment as AssignmentNode).target === node
                            && (assignment as AssignmentNode).contOperator) {
                            const selected = info.selectedType && resolveType(info.selectedType);
                            if (selected?.kind === SemanticTypeKind.Reference
                                || selected?.kind === SemanticTypeKind.VoidReference) {
                                const last = info.segments[info.segments.length - 1];
                                if (last && bindings.has(last.identifier)) {
                                    protection.set(last.identifier, last.assignmentProtected || selected.targetInvariant);
                                }
                            }
                        }
                    }
                }
            }
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);
        return protection;
    }
}
