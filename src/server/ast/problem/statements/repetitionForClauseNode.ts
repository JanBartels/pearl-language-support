// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstNode } from "../../astNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { RepetitionForDocumentationProvider } from
    "../../../documentation/problem/statements/repetitionForDocumentationProvider";

/** FOR introduces the implicitly typed FIXED control variable. */
export class RepetitionForClauseNode extends AstNode {

    private static readonly provider = new RepetitionForDocumentationProvider();

    constructor(
        public readonly forKeyword: SourceValue<string>,
        public readonly variable: SourceValue<string> | undefined
    ) {
        super(AstKind.RepetitionForClause);
    }

    override documentationProvider(): DocumentationProvider<RepetitionForClauseNode> {
        return RepetitionForClauseNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.forKeyword)
            ?? this.lookupOwnSourceValue(offset, this.variable);
    }

    override dumpLabel(): string {
        return `RepetitionFor(${this.variable?.value ?? "?"})`;
    }
}
