// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { NamedTypeDocumentationProvider } from "../../../documentation/problem/types/namedTypeDocumentationProvider";

export class NamedTypeNode extends AstNode {

    private static readonly provider =
        new NamedTypeDocumentationProvider();

    constructor(
        public readonly name: SourceValue<string>
    ) {
        super(AstKind.NamedType);
    }

    override documentationProvider():
        DocumentationProvider<NamedTypeNode> {

        return NamedTypeNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        return this.lookupOwnSourceValue(
            offset,
            this.name
        );
    }

    public override dumpLabel(): string {
        return `NamedType(${this.name.value})`;
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }
}
