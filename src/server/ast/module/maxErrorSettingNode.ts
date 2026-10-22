// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';
import { DocumentationProvider } from '../../documentation/documentationProvider';
import { MaxErrorSettingDocumentationProvider } from '../../documentation/module/maxErrorSettingDocumentationProvider';

export class MaxErrorSettingNode extends AstNode {
    private static readonly provider = new MaxErrorSettingDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly maximum: SourceValue<string>
    ) {
        super(AstKind.MaxErrorSetting);
    }

    override documentationProvider(): DocumentationProvider<MaxErrorSettingNode> {
        return MaxErrorSettingNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.lookupOwnSourceValue(offset, this.maximum);
    }

    override dumpLabel(): string {
        return `MaxErrorSetting(${this.maximum.value})`;
    }
}
