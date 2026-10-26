// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { SourceOffset } from '../../core/sourceOffset';
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
        public readonly registerCount?: SourceValue<string>,
        public readonly plusOperator?: SourceValue<string>
    ) {
        super(AstKind.ProcessorSetting);
    }

    override documentationProvider(): DocumentationProvider<ProcessorSettingNode> {
        return ProcessorSettingNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.processor)
            ?? this.lookupOwnSourceValue(position, this.plusOperator)
            ?? this.lookupOwnSourceValue(position, this.fpuKeyword)
            ?? this.lookupOwnSourceValue(position, this.registerCount);
    }

    override dumpLabel(): string {
        return `ProcessorSetting(${this.processor.value})`;
    }
}
