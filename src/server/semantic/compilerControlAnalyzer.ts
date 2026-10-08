// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { ModuleNode } from '../ast/module/moduleNode';
import type { Location } from '../core/location';
import type { CommentToken } from '../lexer';
import { CompilerOptionLookup } from '../lexer/compilerOptionLookup';
import type { ModuleConfiguration } from './moduleConfiguration';
import type { SemanticContext } from './semanticContext';
import {
    SemanticDiagnosticCode,
    SemanticDiagnosticSeverity
} from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';

/**
 * Checks interactions between lexer-level compiler control comments and
 * module-global MODE settings.
 *
 * Compiler control comments deliberately remain lexer information; they are
 * not reconstructed in the AST. This pass combines that information with the
 * semantic ModuleConfiguration only where an interaction really exists.
 */
export class CompilerControlAnalyzer {
    analyze(
        root: AstNode,
        blockComments: readonly CommentToken[],
        semanticContext: SemanticContext
    ): readonly SemanticDiagnostic[] {
        const diagnostics: SemanticDiagnostic[] = [];

        for (const comment of blockComments) {
            const option = CompilerOptionLookup.lookup(
                [comment],
                comment.location.span.start + 3
            );

            if (!option || option.option.charAt(0) !== 'M' || !option.mode) {
                continue;
            }

            const configuration = this.moduleConfigurationAt(
                root,
                comment.location,
                semanticContext
            );

            if (!configuration || configuration.noLineStop) {
                continue;
            }

            diagnostics.push({
                code: SemanticDiagnosticCode.MarkerOptionWithoutNoLineStop,
                severity: SemanticDiagnosticSeverity.Warning,
                location: comment.location,
                message: 'Die Markierungsoption /*+M*/ kann ohne MODE=NOLSTOP die Laufzeit erheblich '
                    + 'verlangsamen. MODE=NOLSTOP reduziert den Aufwand, deaktiviert jedoch den Zeilenstop.'
            });
        }

        return diagnostics;
    }

    private moduleConfigurationAt(
        root: AstNode,
        location: Location,
        semanticContext: SemanticContext
    ): ModuleConfiguration | undefined {
        if (root.kind === AstKind.Module) {
            const module = root as ModuleNode;

            if (module.keyword.location.source !== location.source) {
                return undefined;
            }

            const end = module.modendKeyword?.location;

            if (location.span.start < module.keyword.location.span.start) {
                return undefined;
            }

            if (end && end.source === location.source && location.span.start > end.span.end) {
                return undefined;
            }

            return semanticContext.moduleConfigurations.get(module);
        }

        if (root.kind !== AstKind.TranslationUnit) {
            return undefined;
        }

        const modules = root.getChildren()
            .filter((child): child is ModuleNode => child.kind === AstKind.Module)
            .filter(module => module.keyword.location.source === location.source);

        for (let index = 0; index < modules.length; index++) {
            const module = modules[index];
            const start = module.keyword.location.span.start;
            const end = module.modendKeyword?.location;

            if (location.span.start < start) {
                return semanticContext.moduleConfigurations.get(module);
            }

            if (end && end.source === location.source) {
                if (location.span.start <= end.span.end) {
                    return semanticContext.moduleConfigurations.get(module);
                }

                continue;
            }

            const nextModule = modules[index + 1];

            if (!nextModule || location.span.start < nextModule.keyword.location.span.start) {
                return semanticContext.moduleConfigurations.get(module);
            }
        }

        return undefined;
    }


}
