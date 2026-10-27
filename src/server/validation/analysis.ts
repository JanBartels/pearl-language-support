// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";
import { Token, CommentToken, CommentKind, isCommentToken } from "../lexer/";
import { ProblemCollection } from "../core/problemCollection";
import { MacroReference } from '../preproc/macroReference';
import type { MacroDefinition } from '../preproc/macroDefinition';
import { MacroOccurrenceIndex } from '../preproc/macroOccurrenceIndex';
import { Severity } from "../core/severity";
import { AstNode } from "../ast/astNode";
import { PreprocessorConditionalBlockCollection } from "../preproc/preprocessorConditionalBlockCollection";
import { SemanticContext } from "../semantic/semanticContext";
import { SymbolReferenceIndex } from '../semantic/symbolReferenceIndex';
import { SymbolReferenceResolutionIndex } from '../semantic/symbolReferenceResolutionIndex';
import { SymbolOccurrenceIndex } from '../semantic/symbolOccurrenceIndex';
import { CallSignatureIndex } from '../semantic/callSignatureIndex';
import { CallSignatureHelpIndex } from '../semantic/callSignatureHelpIndex';

export function collectBlockComments(tokens: readonly Token[]): readonly CommentToken[] {
    return tokens.filter(
        (token): token is CommentToken =>
            isCommentToken(token)
            && token.commentKind === CommentKind.Block
    );
}

export class Analysis {

    constructor(

        readonly source: Source,

        readonly tokens: readonly Token[],

        readonly ast: AstNode,

        readonly problems: ProblemCollection,

        readonly macroReferences: MacroReference[],

        readonly preprocessorConditionalBlocks: PreprocessorConditionalBlockCollection,

        readonly semanticContext?: SemanticContext,

        /** All syntactic symbol usages, including unresolved ones. */
        readonly symbolReferences: SymbolReferenceIndex = new SymbolReferenceIndex(),

        /** Semantic results of the syntactically recorded symbol references. */
        readonly symbolReferenceResolutions: SymbolReferenceResolutionIndex = new SymbolReferenceResolutionIndex(),

        /** Declaration and reference occurrences grouped by semantic identity. */
        readonly symbolOccurrences: SymbolOccurrenceIndex = new SymbolOccurrenceIndex(symbolReferenceResolutions, semanticContext ?? new SemanticContext()),

        /** Macro definitions gathered by the preprocessor, even if unused. */
        readonly macroDefinitions: readonly MacroDefinition[] = [],

        /** Macro occurrence groups, independent of semantic PEARL symbols. */
        readonly macroOccurrences: MacroOccurrenceIndex = new MacroOccurrenceIndex(macroDefinitions, macroReferences),

        /** Active block comments from this translation unit, including nested includes. */
        readonly activeBlockComments: readonly CommentToken[] = []

    ) {
    }

    private cachedCallSignatureIndex?: CallSignatureIndex;

    /** Shared compiler-side index, built once per analysis. */
    get callSignatures(): CallSignatureIndex | undefined {
        if (!this.semanticContext) return undefined;
        if (!this.cachedCallSignatureIndex) {
            this.cachedCallSignatureIndex = new CallSignatureIndex(
                this.ast, this.semanticContext, this.activeBlockComments);
        }
        return this.cachedCallSignatureIndex;
    }

    private cachedCallSignatureHelp?: CallSignatureHelpIndex;

    /** Built once per completed translation-unit analysis and reused on edits. */
    get callSignatureHelp(): CallSignatureHelpIndex | undefined {
        if (!this.semanticContext) return undefined;
        if (!this.cachedCallSignatureHelp) {
            const signatures = this.callSignatures;
            if (!signatures) return undefined;
            this.cachedCallSignatureHelp = new CallSignatureHelpIndex(this.ast, signatures);
        }
        return this.cachedCallSignatureHelp;
    }

    private cachedBlockComments?: readonly CommentToken[];

    get blockComments(): readonly CommentToken[] {

        if (!this.cachedBlockComments) {

            this.cachedBlockComments = collectBlockComments(this.tokens);
        }

        return this.cachedBlockComments;
    }

    hasErrors(): boolean {
        return this.problems.some(
            p => p.severity === Severity.Error
        );
    }

    hasWarnings(): boolean {
        return this.problems.some(
            p => p.severity === Severity.Warning
        );
    }
}