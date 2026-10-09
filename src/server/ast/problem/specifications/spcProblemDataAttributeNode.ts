// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import {
    SpcProblemDataAttributeDocumentationProvider
} from '../../../documentation/problem/specifications/spcProblemDataAttributeDocumentationProvider';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { GlobalAttributeNode } from '../declarations/globalAttributeNode';
import { ProblemDataTypeNode } from '../types/problemDataTypeNode';

export class SpcProblemDataAttributeNode extends AstNode {
    private static readonly provider = new SpcProblemDataAttributeDocumentationProvider();

    constructor(
        public readonly inv: SourceValue<string> | undefined,
        public readonly type: ProblemDataTypeNode | undefined,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.SpcProblemDataAttribute);

        if (type) {
            this.adopt(type);
        }
        if (global) {
            this.adopt(global);
        }
    }

    override documentationProvider(): DocumentationProvider<SpcProblemDataAttributeNode> {
        return SpcProblemDataAttributeNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.inv)
            ?? this.type?.lookupSourceValue(offset)
            ?? this.global?.lookupSourceValue(offset);
    }

    override dumpLabel(): string {
        const attributes: string[] = [];
        if (this.inv) {
            attributes.push('INV');
        }
        if (this.global) {
            attributes.push('GLOBAL');
        }

        return attributes.length > 0 ? `SpcProblemDataAttribute(${attributes.join(', ')})` : 'SpcProblemDataAttribute';
    }

    override getChildren(): readonly AstNode[] {
        const children: AstNode[] = [];
        if (this.type) {
            children.push(this.type);
        }
        if (this.global) {
            children.push(this.global);
        }
        return children;
    }
}
