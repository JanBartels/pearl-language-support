// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { ModuleNode } from '../ast/module/moduleNode';
import { ProcedureDeclarationNode } from '../ast/problem/declarations/procedureDeclarationNode';
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
 * Validates lexer-level compiler control comments against AST context and
 * semantic module settings.
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

            if (!option) {
                continue;
            }

            if (option.option.charAt(0) === 'G' && option.mode) {
                this.analyzeGOption(root, comment, diagnostics);
                continue;
            }

            if (option.option.charAt(0) !== 'M' || !option.mode) {
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

    /**
     * +G is a lexer-level compiler option, not a PEARL grammar production.
     * RTOS-UH recognizes it only between PROC/PROCEDURE and the next
     * grammatical header token. The loader additionally requires +G
     * procedures to precede the first TASK of the module: the loader scans
     * 17-type slices in module heads, while the memory chain consists of
     * module (MDLE) and TASK entries. This constraint follows from the loader
     * structure, even though it is not stated explicitly as a placement rule
     * in the RTOS-UH manual.
     *
     * RTOS-UH 5.4.6 distinguishes the +G option from the PEARL GLOBAL
     * attribute; the compiler option does not itself make a procedure global.
     */
    private analyzeGOption(
        root: AstNode,
        comment: CommentToken,
        diagnostics: SemanticDiagnostic[]
    ): void {
        for (const module of this.modulesOf(root)) {
            const declarations = module.problemPart?.children ?? [];
            for (let index = 0; index < declarations.length; index++) {
                const declaration = declarations[index];
                if (declaration.kind !== AstKind.ProcedureDeclaration) {
                    continue;
                }

                const procedure = declaration as ProcedureDeclarationNode;
                if (!this.isGOptionInHeader(comment.location, procedure)) {
                    continue;
                }

                const firstTaskIndex = declarations.findIndex(
                    child => child.kind === AstKind.TaskDeclaration
                );
                if (firstTaskIndex >= 0 && index > firstTaskIndex) {
                    diagnostics.push({
                        code: SemanticDiagnosticCode.GProcedureAfterFirstTask,
                        severity: SemanticDiagnosticSeverity.Error,
                        location: comment.location,
                        message: `PROC '${procedure.name.value}' mit /*+G*/ muss vor der `
                            + 'ersten TASK des Moduls stehen (RTOS-UH-Laderbedingung).'
                    });
                }

                return;
            }
        }

        diagnostics.push({
            code: SemanticDiagnosticCode.GOptionOutsideProcedureHeader,
            severity: SemanticDiagnosticSeverity.Warning,
            location: comment.location,
            message: '/*+G*/ wird von RTOS-UH nur unmittelbar hinter PROC oder PROCEDURE '
                + 'im Prozedurkopf berücksichtigt.'
        });
    }

    private isGOptionInHeader(
        comment: Location,
        procedure: ProcedureDeclarationNode
    ): boolean {
        const keyword = procedure.procKeyword.location;
        const nextToken = procedure.firstHeaderTokenAfterProc()?.location;
        if (!keyword || !nextToken || comment.source !== keyword.source
            || nextToken.source !== keyword.source) {
            return false;
        }

        return keyword.span.end <= comment.span.start
            && comment.span.end <= nextToken.span.start;
    }

    private modulesOf(root: AstNode): readonly ModuleNode[] {
        if (root.kind === AstKind.Module) {
            return [root as ModuleNode];
        }
        if (root.kind !== AstKind.TranslationUnit) {
            return [];
        }
        return root.getChildren()
            .filter((node): node is ModuleNode => node.kind === AstKind.Module);
    }

    private moduleConfigurationAt(
        root: AstNode,
        location: Location,
        semanticContext: SemanticContext
    ): ModuleConfiguration | undefined {
        if (root.kind === AstKind.Module) {
            const module = root as ModuleNode;

            if (!module.keyword.location || module.keyword.location.source !== location.source) {
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
            .filter((module): module is ModuleNode & { keyword: { location: Location } } =>
                module.keyword.location?.source === location.source);

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
