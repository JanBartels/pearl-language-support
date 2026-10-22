// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';
import { DocumentationProvider } from '../../documentation/documentationProvider';
import { ProcessorSettingDocumentationProvider } from '../../documentation/module/processorSettingDocumentationProvider';

/** Syntax of a module-global P=...; statement (no resolved CPU semantics). */
export class ProcessorSettingNode extends AstNode {
    private static readonly provider = new ProcessorSettingDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly processor: SourceValue<string>,
        public readonly fpuKeyword?: SourceValue<string>,
        public readonly registerCount?: SourceValue<string>
    ) {
        super(AstKind.ProcessorSetting);
    }

    override documentationProvider(): DocumentationProvider<ProcessorSettingNode> {
        return ProcessorSettingNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.lookupOwnSourceValue(offset, this.processor)
            ?? this.lookupOwnSourceValue(offset, this.fpuKeyword)
            ?? this.lookupOwnSourceValue(offset, this.registerCount);
    }

    override dumpLabel(): string {
        return `ProcessorSetting(${this.processor.value})`;
    }
}
