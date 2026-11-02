// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { SourceOffset } from "../../../core/sourceOffset";
import { AstKind } from "../../astKind";
import { AstNode } from "../../astNode";
import { AstLookupResult } from "../../astLookupResult";

/** A SEMA or BOLT component type within a STRUCT. */
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { SynchronizationTypeDocumentationProvider } from '../../../documentation/problem/types/synchronizationTypeDocumentationProvider';

export class SynchronizationTypeNode extends AstNode {

    constructor(public readonly keyword: SourceValue<string>) {
        super(AstKind.SynchronizationType);
    }

    private static readonly provider = new SynchronizationTypeDocumentationProvider();

    override documentationProvider(): DocumentationProvider<SynchronizationTypeNode> {
        return SynchronizationTypeNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword);
    }

    override getChildren(): readonly AstNode[] { return []; }

    override dumpLabel(): string {
        return `SynchronizationType(${this.keyword.value})`;
    }
}
