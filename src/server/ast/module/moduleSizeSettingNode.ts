// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { SourceOffset } from '../../core/sourceOffset';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';
import { DocumentationProvider } from '../../documentation/documentationProvider';
import { ModuleSizeSettingDocumentationProvider } from '../../documentation/module/moduleSizeSettingDocumentationProvider';

/** Module size, optional ROM code and variable addresses; values remain source text. */
export class ModuleSizeSettingNode extends AstNode {
    private static readonly provider = new ModuleSizeSettingDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly size: SourceValue<string>,
        public readonly codeKeyword?: SourceValue<string>,
        public readonly codeAddress?: SourceValue<string>,
        public readonly varKeyword?: SourceValue<string>,
        public readonly varAddress?: SourceValue<string>
    ) {
        super(AstKind.ModuleSizeSetting);
    }

    override documentationProvider(): DocumentationProvider<ModuleSizeSettingNode> {
        return ModuleSizeSettingNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.size)
            ?? this.lookupOwnSourceValue(position, this.codeKeyword)
            ?? this.lookupOwnSourceValue(position, this.codeAddress)
            ?? this.lookupOwnSourceValue(position, this.varKeyword)
            ?? this.lookupOwnSourceValue(position, this.varAddress);
    }

    override dumpLabel(): string {
        return `ModuleSizeSetting(${this.keyword.value}=${this.size.value})`;
    }
}
