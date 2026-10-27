// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { DclDationAttributeDocumentationProvider } from '../../../documentation/problem/declarations/dclDationAttributeDocumentationProvider';
import { GlobalAttributeNode } from './globalAttributeNode';

/** DCL name DATION direction class [CONTROL(ALL)] [GLOBAL] CREATED(systemDation). */
export class DclDationAttributeNode extends AstNode {
    private static readonly provider = new DclDationAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly direction: SourceValue<string> | undefined,
        public readonly dationClass: SourceValue<string> | undefined,
        public readonly controlKeyword: SourceValue<string> | undefined,
        public readonly controlAll: SourceValue<string> | undefined,
        public readonly global: GlobalAttributeNode | undefined,
        public readonly createdKeyword: SourceValue<string> | undefined,
        public readonly systemDation: SourceValue<string> | undefined
    ) {
        super(AstKind.DclDationAttribute);
        if (global) this.adopt(global);
    }

    override documentationProvider(): DocumentationProvider<DclDationAttributeNode> {
        return DclDationAttributeNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.direction)
            ?? this.lookupOwnSourceValue(position, this.dationClass)
            ?? this.lookupOwnSourceValue(position, this.controlKeyword)
            ?? this.lookupOwnSourceValue(position, this.controlAll)
            ?? this.global?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.createdKeyword)
            ?? this.lookupOwnSourceValue(position, this.systemDation);
    }

    override dumpLabel(): string {
        return `DclDationAttribute(${this.direction?.value ?? '?'}, ${this.dationClass?.value ?? '?'}, CREATED(${this.systemDation?.value ?? '?' }))`;
    }

    override getChildren(): readonly AstNode[] {
        return this.global ? [this.global] : [];
    }
}
