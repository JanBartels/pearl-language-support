// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import {
    SpcDationAttributeDocumentationProvider
} from '../../../documentation/problem/specifications/spcDationAttributeDocumentationProvider';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { GlobalAttributeNode } from '../declarations/globalAttributeNode';

export class SpcDationAttributeNode extends AstNode {
    private static readonly provider = new SpcDationAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly direction: SourceValue<string> | undefined,
        public readonly dationClass: SourceValue<string> | undefined,
        public readonly controlKeyword: SourceValue<string> | undefined,
        public readonly controlAll: SourceValue<string> | undefined,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.SpcDationAttribute);

        if (global) {
            this.adopt(global);
        }
    }

    override documentationProvider(): DocumentationProvider<SpcDationAttributeNode> {
        return SpcDationAttributeNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.direction)
            ?? this.lookupOwnSourceValue(position, this.dationClass)
            ?? this.lookupOwnSourceValue(position, this.controlKeyword)
            ?? this.lookupOwnSourceValue(position, this.controlAll)
            ?? this.global?.lookupSourceValue(position);
    }

    override dumpLabel(): string {
        const parts = [this.direction?.value, this.dationClass?.value].filter((value): value is string => !!value);

        if (this.controlKeyword) {
            parts.push('CONTROL(ALL)');
        }
        if (this.global) {
            parts.push('GLOBAL');
        }

        return parts.length > 0 ? `SpcDationAttribute(${parts.join(', ')})` : 'SpcDationAttribute';
    }

    override getChildren(): readonly AstNode[] {
        return this.global ? [this.global] : [];
    }
}
