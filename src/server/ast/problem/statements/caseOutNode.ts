// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstNode } from "../../astNode";
import type { CaseStatementNode } from "./caseStatementNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { CaseOutDocumentationProvider } from
    "../../../documentation/problem/statements/caseOutDocumentationProvider";

export class CaseOutNode extends AstNode {

    private static readonly provider = new CaseOutDocumentationProvider();

    constructor(
        public readonly outKeyword: SourceValue<string>,
        public readonly body: readonly AstNode[]
    ) {
        super(AstKind.CaseOut);
        this.adoptAll(body);
    }

    /** Source text of the selector in the containing CASE, if available. */
    caseSelectorText(): string | undefined {
        const parent = this.parent;
        return parent?.kind === AstKind.CaseStatement
            ? (parent as CaseStatementNode).selectorText()
            : undefined;
    }

    override documentationProvider(): DocumentationProvider<CaseOutNode> {
        return CaseOutNode.provider;
    }

    override getChildren(): readonly AstNode[] {
        return this.body;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        for (const child of this.body) {
            const result = child.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }
        return this.lookupOwnSourceValue(offset, this.outKeyword);
    }
}
