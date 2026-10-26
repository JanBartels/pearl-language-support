// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { SourceOffset } from '../../../core/sourceOffset';
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
        position: SourceOffset
    ): AstLookupResult | undefined {

        for (const identifier of this.identifiers) {
            const result = this.lookupOwnSourceValue(position, identifier);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        const names =
                this.identifiers
                    .map(identifier => identifier.value)
                    .join(", ");

        return `Identifiers(${this.identifiers.length}: ${names})`;
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }

}
