// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';
import { DocumentationProvider } from '../../documentation/documentationProvider';
import { SetLineSettingDocumentationProvider } from '../../documentation/module/setLineSettingDocumentationProvider';

export class SetLineSettingNode extends AstNode {
    private static readonly provider = new SetLineSettingDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly firstLine: SourceValue<string>,
        public readonly moduleId?: SourceValue<string>
    ) {
        super(AstKind.SetLineSetting);
    }

    override documentationProvider(): DocumentationProvider<SetLineSettingNode> {
        return SetLineSettingNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.lookupOwnSourceValue(offset, this.firstLine)
            ?? this.lookupOwnSourceValue(offset, this.moduleId);
    }

    override dumpLabel(): string {
        return `SetLineSetting(${this.firstLine.value}${this.moduleId ? ',' + this.moduleId.value : ''})`;
    }
}
