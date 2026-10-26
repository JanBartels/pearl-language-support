// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstNode } from "../../astNode";
import { SourceOffset } from '../../../core/sourceOffset';
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

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.forKeyword)
            ?? this.lookupOwnSourceValue(position, this.variable);
    }

    override dumpLabel(): string {
        return `RepetitionFor(${this.variable?.value ?? "?"})`;
    }
}
