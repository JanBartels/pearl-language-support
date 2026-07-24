// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { OneIdentifierOrListDocumentationProvider } from "../../../documentation/problem/identifiers/oneIdentifierOrListDocumentationProvider";

/**
 * EBNF:
 *
 *     OneIdentifierOrList ::= Identifier
 *                           | ( Identifier [ , Identifier ] ... )
 */
export class OneIdentifierOrListNode extends AstNode {

    private static readonly provider =
        new OneIdentifierOrListDocumentationProvider();

    constructor(
        public readonly parenthesized: boolean,
        public readonly identifiers: readonly SourceValue<string>[]
    ) {
        super(AstKind.OneIdentifierOrList);
    }

    override documentationProvider():
        DocumentationProvider<OneIdentifierOrListNode> {

        return OneIdentifierOrListNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        for (const identifier of this.identifiers) {
            const result = this.lookupOwnSourceValue(offset, identifier);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        return `Identifiers(${this.identifiers.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }

}
