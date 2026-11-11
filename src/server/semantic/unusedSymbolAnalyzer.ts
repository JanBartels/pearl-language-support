// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SemanticContext } from './semanticContext';
import {
    SemanticDiagnosticCode,
    SemanticDiagnosticSeverity,
    type SemanticDiagnostic
} from './semanticDiagnostic';
import type { SemanticSymbol } from './symbol';
import { SymbolKind } from './symbolKind';
import type { SymbolReferenceResolutionIndex } from './symbolReferenceResolutionIndex';
import { SymbolAccessClassifier } from './symbolAccessClassifier';
import { SemanticTypeKind, type SemanticType } from './semanticType';
import { SymbolAccessKind, SymbolUsageIndex, type SymbolAccess, type SymbolUsage } from './symbolUsageIndex';

export interface UnusedSymbolAnalysis {
    readonly usages: SymbolUsageIndex;
    readonly diagnostics: readonly SemanticDiagnostic[];
}

/**
 * A separate semantic pass after binding and reference resolution.
 *
 * Do not count declaration bindings as references: a declaration can be
 * present in SemanticContext.bindings even if it is never used. Conversely,
 * only the existing resolver can decide which declaration a use denotes.
 */
export class UnusedSymbolAnalyzer {
    analyze(semantic: SemanticContext, resolutions: SymbolReferenceResolutionIndex): UnusedSymbolAnalysis {
        const usages: SymbolUsage[] = [];
        const diagnostics: SemanticDiagnostic[] = [];
        const seen = new Set<SourceValue<string>>();
        const classifier = new SymbolAccessClassifier(semantic);

        for (const [identifier, symbol] of semantic.bindings) {
            if (!this.isDeclaration(identifier, symbol) || !this.isCandidate(symbol)) {
                continue;
            }

            const declaration = symbol.definition ?? symbol.name;
            if (!declaration.location || seen.has(declaration)) {
                continue;
            }
            seen.add(declaration);

            // A local SPC may precede a real PROC/TASK declaration. Prefer the
            // definitive symbol: it carries properties such as TASK MAIN.
            const definitionSymbol = semantic.bindings.get(declaration) ?? symbol;
            const bound = resolutions.referencesOf(declaration)
                .filter(result => result.kind === 'bound');
            const references = bound.map(result => result.reference);
            const accesses: SymbolAccess[] = bound.map(result => ({
                reference: result.reference,
                kind: classifier.classify(result)
            }));
            const externallyVisible = 'global' in definitionSymbol && definitionSymbol.global !== undefined;
            const implicitlyUsed = definitionSymbol.kind === SymbolKind.Task && definitionSymbol.main === true;
            if (implicitlyUsed) accesses.push({ kind: SymbolAccessKind.Implicit });

            const read = accesses.some(access => access.kind === SymbolAccessKind.Read);
            const written = accesses.some(access => access.kind === SymbolAccessKind.Write);
            const addressTaken = accesses.some(access => access.kind === SymbolAccessKind.Address);
            const uncertain = accesses.some(access => access.kind === SymbolAccessKind.Unknown);
            const initialized = definitionSymbol.kind === SymbolKind.DataObject
                && semantic.initialValues.has(definitionSymbol);
            const unused = references.length === 0 && !externallyVisible && !implicitlyUsed;
            usages.push({ symbol: definitionSymbol, declaration, references, accesses,
                read, written, addressTaken, uncertain, initialized,
                externallyVisible, implicitlyUsed, unused });

            // Do not cascade warnings at erroneous declaration sites. Keep
            // diagnostics separate from the reusable usage information.
            if (this.hasDeclarationError(semantic, declaration)) continue;
            if (unused) {
                diagnostics.push({
                    code: SemanticDiagnosticCode.UnusedSymbol,
                    severity: SemanticDiagnosticSeverity.Warning,
                    location: declaration.location,
                    message: `Symbol '${declaration.value}' wird nicht verwendet.`
                });
                continue;
            }

            // No control-flow assumptions: a definite address escape or an
            // unclassified use is enough to suppress access-mode warnings.
            // GLOBAL is assumed accessible from another module.
            if (externallyVisible || addressTaken || uncertain
                || !this.isAccessDiagnosticCandidate(definitionSymbol, semantic)) continue;

            if (written && !read) {
                diagnostics.push({
                    code: SemanticDiagnosticCode.WrittenButNeverRead,
                    severity: SemanticDiagnosticSeverity.Warning,
                    location: declaration.location,
                    message: `Variable '${declaration.value}' wird beschrieben, aber niemals gelesen.`
                });
            } else if (read && !written && !initialized) {
                diagnostics.push({
                    code: SemanticDiagnosticCode.ReadButNeverWritten,
                    severity: SemanticDiagnosticSeverity.Warning,
                    location: declaration.location,
                    message: `Variable '${declaration.value}' wird gelesen, aber niemals beschrieben.`
                });
            }
        }

        // The label resolver runs before ordinary semantic analysis. Report
        // warnings in source order rather than resolver/insertion order.
        const compareLocations = (left: SourceValue<string>, right: SourceValue<string>): number => {
            const a = left.location!;
            const b = right.location!;
            return a.source.uri.localeCompare(b.source.uri)
                || a.span.start - b.span.start
                || a.span.end - b.span.end;
        };
        usages.sort((a, b) => compareLocations(a.declaration, b.declaration));
        diagnostics.sort((a, b) =>
            a.location.source.uri.localeCompare(b.location.source.uri)
            || a.location.span.start - b.location.span.start
            || a.location.span.end - b.location.span.end
        );

        return { usages: new SymbolUsageIndex(usages), diagnostics };
    }

    private isDeclaration(identifier: SourceValue<string>, symbol: SemanticSymbol): boolean {
        return identifier === symbol.name || identifier === symbol.definition;
    }

    private isCandidate(symbol: SemanticSymbol): boolean {
        switch (symbol.kind) {
            case SymbolKind.DataObject:
            case SymbolKind.Type:
            case SymbolKind.Parameter:
            case SymbolKind.Identification:
            case SymbolKind.Procedure:
            case SymbolKind.Task:
            case SymbolKind.Format:
            case SymbolKind.Label:
                // Unresolved REF type placeholders have no real declaration.
                return symbol.kind !== SymbolKind.Type || symbol.definition !== undefined;

            // Loop control variables participate implicitly in FOR execution.
            // STRUCT components can be used as part of their aggregate value.
            // Neither has a reliable independent "unused" meaning yet.
            case SymbolKind.LoopControlVariable:
            case SymbolKind.StructComponent:
            case SymbolKind.Module:
                return false;
        }
    }

    /** Ordinary data objects only: not SEMA/BOLT/DATION/INTERRUPT handles. */
    private isAccessDiagnosticCandidate(symbol: SemanticSymbol, semantic: SemanticContext): boolean {
        if (symbol.kind !== SymbolKind.DataObject || symbol.systemDationSpecification) return false;
        let type: SemanticType | undefined = symbol.type;
        const visited = new Set<object>();
        while (type?.kind === SemanticTypeKind.Named) {
            if (visited.has(type.symbol)) return false;
            visited.add(type.symbol);
            type = semantic.typeDefinitions.get(type.symbol);
        }
        if (!type) return false;
        return type.kind !== SemanticTypeKind.Sema
            && type.kind !== SemanticTypeKind.Bolt
            && type.kind !== SemanticTypeKind.Dation
            && type.kind !== SemanticTypeKind.Interrupt
            && type.kind !== SemanticTypeKind.Task
            && type.kind !== SemanticTypeKind.Procedure;
    }

    private hasDeclarationError(semantic: SemanticContext, declaration: SourceValue<string>): boolean {
        const location = declaration.location;
        if (!location) return true;
        return semantic.diagnostics.some(diagnostic =>
            diagnostic.severity === SemanticDiagnosticSeverity.Error
            && diagnostic.location.source === location.source
            && diagnostic.location.span.start === location.span.start
            && diagnostic.location.span.end === location.span.end
        );
    }
}
