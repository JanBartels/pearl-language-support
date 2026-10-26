// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstNode } from "../../astNode";
import type { CaseStatementNode } from "./caseStatementNode";
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { CaseAlternativeDocumentationProvider } from
    "../../../documentation/problem/statements/caseAlternativeDocumentationProvider";
import { statementTokenText } from "./statementTokenText";

export class CaseAlternativeNode extends AstNode {

    private static readonly provider = new CaseAlternativeDocumentationProvider();

    constructor(
        public readonly altKeyword: SourceValue<string>,
        /** Undefined for positional ALT, including parentheses for indexed ALT. */
        public readonly caseListTokens: readonly SourceValue<string>[] | undefined,
        public readonly body: readonly AstNode[],
        /** 1-based position in the containing CASE; also retained for indexed ALT. */
        public readonly position: number
    ) {
        super(AstKind.CaseAlternative);
        this.adoptAll(body);
    }

    /** Source text of the selector in the containing CASE, if available. */
    caseSelectorText(): string | undefined {
        const parent = this.parent;
        return parent?.kind === AstKind.CaseStatement
            ? (parent as CaseStatementNode).selectorText()
            : undefined;
    }

    override documentationProvider(): DocumentationProvider<CaseAlternativeNode> {
        return CaseAlternativeNode.provider;
    }

    override getChildren(): readonly AstNode[] {
        return this.body;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const child of this.body) {
            const result = child.lookupSourceValue(position);
            if (result) {
                return result;
            }
        }
        for (const token of [this.altKeyword, ...(this.caseListTokens ?? [])]) {
            const result = this.lookupOwnSourceValue(position, token);
            if (result) {
                return result;
            }
        }
        return undefined;
    }

    override dumpLabel(): string {
        return this.caseListTokens ? "CaseAlternative(indexed)" : "CaseAlternative";
    }

    caseListText(): string | undefined {
        return this.caseListTokens && statementTokenText(this.caseListTokens);
    }
}
