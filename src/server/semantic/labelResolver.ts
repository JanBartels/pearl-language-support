// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { GotoStatementNode } from '../ast/problem/statements/gotoStatementNode';
import { LabeledStatementNode } from '../ast/problem/statements/labeledStatementNode';
import type { SourceValue } from '../core/sourceValue';
import { DeclarationIndex } from './declarationIndex';
import type { Scope } from './scope';
import { ScopeKind } from './scope';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { LabelSymbol, SemanticSymbol } from './symbol';
import { SymbolKind } from './symbolKind';

export interface LabelResolution {
    readonly bindings: ReadonlyMap<SourceValue<string>, SemanticSymbol>;
    readonly diagnostics: readonly SemanticDiagnostic[];
}

interface GotoReference {
    readonly node: GotoStatementNode;
    readonly scope: Scope;
    readonly owner: Scope;
}

/**
 * CASE is a control-flow boundary, not a lexical Scope. Keep these two
 * concepts separate so label checks do not change ordinary name visibility.
 * Labels attached to a CASE statement itself are outside that CASE.
 */
function enclosingCases(node: AstNode): ReadonlySet<AstNode> {
    const cases = new Set<AstNode>();
    for (let current = node.parent; current; current = current.parent) {
        if (current.kind === AstKind.CaseStatement) cases.add(current);
    }
    return cases;
}

/** The enclosing task/procedure determines the maximal scope of a GOTO. */
function executableOwner(scope: Scope): Scope | undefined {
    for (let current: Scope | undefined = scope; current; current = current.parent) {
        if (current.kind === ScopeKind.Task || current.kind === ScopeKind.Procedure) {
            return current;
        }
    }
    return undefined;
}

/**
 * Resolve label declarations and GOTO references after structural indexing.
 *
 * Labels are entered in the same DeclarationIndex as other declarations, but
 * references are resolved in a second pass so forward targets are supported.
 * A GOTO may leave inner scopes; it must not enter a nested or sibling scope.
 * Nothing is added to sequential Environments (where it would prohibit forward
 * references). The resulting bindings are used by the existing LSP features.
 */
export function resolveLabels(
    root: AstNode,
    scopes: ReadonlyMap<AstNode, Scope>,
    declarationIndex: DeclarationIndex
): LabelResolution {
    const bindings = new Map<SourceValue<string>, SemanticSymbol>();
    const diagnostics: SemanticDiagnostic[] = [];
    const byScope = new Map<Scope, Map<string, LabelSymbol>>();
    const byOwner = new Map<Scope, Map<string, LabelSymbol[]>>();
    const references: GotoReference[] = [];
    const casesByLabel = new Map<LabelSymbol, ReadonlySet<AstNode>>();

    const reportDuplicate = (name: SourceValue<string>, previous: SourceValue<string>): void => {
        if (!name.location) return;
        diagnostics.push({
            code: SemanticDiagnosticCode.DuplicateDeclaration,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Sprungmarke '${name.value}' ist in diesem Gültigkeitsbereich bereits vergeben.`,
            relatedLocations: previous.location
                ? [{ location: previous.location, message: 'Bereits vorhandene Deklaration.' }]
                : undefined
        });
    };

    const visit = (node: AstNode, inheritedScope: Scope | undefined): void => {
        const scope = scopes.get(node) ?? inheritedScope;

        if (node.kind === AstKind.LabeledStatement && scope) {
            const owner = executableOwner(scope);
            if (owner) {
                for (const name of (node as LabeledStatementNode).labels) {
                    const existing = declarationIndex.index(scope, { kind: SymbolKind.Label, name });
                    if (existing) {
                        reportDuplicate(name, existing.name);
                        continue;
                    }
                    const symbol: LabelSymbol = { kind: SymbolKind.Label, name, definition: name };
                    bindings.set(name, symbol);
                    casesByLabel.set(symbol, enclosingCases(node));

                    let labels = byScope.get(scope);
                    if (!labels) {
                        labels = new Map();
                        byScope.set(scope, labels);
                    }
                    labels.set(name.value, symbol);

                    let ownerLabels = byOwner.get(owner);
                    if (!ownerLabels) {
                        ownerLabels = new Map();
                        byOwner.set(owner, ownerLabels);
                    }
                    const sameName = ownerLabels.get(name.value) ?? [];
                    sameName.push(symbol);
                    ownerLabels.set(name.value, sameName);
                }
            }
        }

        if (node.kind === AstKind.GotoStatement && scope) {
            const owner = executableOwner(scope);
            if (owner) references.push({ node: node as GotoStatementNode, scope, owner });
        }

        for (const child of node.getChildren()) visit(child, scope);
    };

    visit(root, undefined);

    for (const { node, scope, owner } of references) {
        const target = node.target;
        if (!target?.location) continue;

        let found: LabelSymbol | undefined;
        for (let current: Scope | undefined = scope; current; current = current.parent) {
            found = byScope.get(current)?.get(target.value);
            if (found || current === owner) break;
        }
        if (found) {
            const sourceCases = enclosingCases(node);
            const targetCases = casesByLabel.get(found);
            const entersCase = targetCases && [...targetCases].some(c => !sourceCases.has(c));

            if (entersCase) {
                diagnostics.push({
                    code: SemanticDiagnosticCode.InvalidGotoIntoCase,
                    severity: SemanticDiagnosticSeverity.Error,
                    location: target.location,
                    message: `GOTO '${target.value}' darf nicht in eine CASE-Anweisung hineinspringen.`,
                    relatedLocations: found.name.location
                        ? [{ location: found.name.location, message: 'Hier ist die Sprungmarke innerhalb von CASE definiert.' }]
                        : undefined
                });
                continue;
            }

            bindings.set(target, found);
            continue;
        }

        // Another label in the same task/procedure means the target exists but
        // is not accessible without entering an inner or sibling lexical scope.
        const inaccessible = byOwner.get(owner)?.get(target.value)?.[0];
        diagnostics.push({
            code: inaccessible
                ? SemanticDiagnosticCode.InvalidGotoIntoBlock
                : SemanticDiagnosticCode.UnknownLabel,
            severity: SemanticDiagnosticSeverity.Error,
            location: target.location,
            message: inaccessible
                ? `GOTO '${target.value}' darf nicht in einen inneren oder fremden Block bzw. eine Schleife springen.`
                : `Unbekannte Sprungmarke '${target.value}' in dieser Task oder Prozedur.`,
            relatedLocations: inaccessible?.name.location
                ? [{ location: inaccessible.name.location, message: 'Hier ist die nicht erreichbare Sprungmarke definiert.' }]
                : undefined
        });
    }

    return { bindings, diagnostics };
}
