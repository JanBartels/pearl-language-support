// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";
import { Token, CommentToken, CommentKind, isCommentToken } from "../lexer/";
import { ProblemCollection } from "../core/problemCollection";
import { MacroReference } from '../preproc/macroReference';
import { Severity } from "../core/severity";
import { AstNode } from "../ast/astNode";
import { PreprocessorConditionalBlockCollection } from "../preproc/preprocessorConditionalBlockCollection";
import { SemanticContext } from "../semantic/semanticContext";

export class Analysis {

    constructor(

        readonly source: Source,

        readonly tokens: readonly Token[],

        readonly ast: AstNode,

        readonly problems: ProblemCollection,

        readonly macroReferences: MacroReference[],

        readonly preprocessorConditionalBlocks: PreprocessorConditionalBlockCollection,

        readonly semanticContext?: SemanticContext

    ) {
    }

    private cachedBlockComments?: readonly CommentToken[];

    get blockComments(): readonly CommentToken[] {

        if (!this.cachedBlockComments) {

            this.cachedBlockComments = this.tokens.filter(
                (token): token is CommentToken =>
                    isCommentToken(token)
                    && token.commentKind === CommentKind.Block
            );
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