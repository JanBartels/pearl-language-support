// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";
import { Token } from "../lexer/token";
import { ProblemCollection } from "../core/problemCollection";
import { Severity } from "../core/severity";
import { AstNode } from "../ast/astNode";
import { SemanticContext } from "../semantic/semanticContext";

export class Analysis {

    constructor(

        readonly source: Source,

        readonly tokens: readonly Token[],

        readonly ast: AstNode,

        readonly problems: ProblemCollection,

        readonly semanticContext?: SemanticContext

    ) {
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