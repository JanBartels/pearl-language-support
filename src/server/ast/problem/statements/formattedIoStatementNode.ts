// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { FormattedIoStatementDocumentationProvider } from '../../../documentation/problem/statements/formattedIoStatementDocumentationProvider';
import type { ExpressionNode } from '../expressions/expressionNode';
import type { FormatListNode } from './formatListNode';

/** Common syntax for GET/PUT and both directions of CONVERT. */
export class FormattedIoStatementNode extends AstNode {
    private static readonly provider = new FormattedIoStatementDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly objects: readonly ExpressionNode[],
        public readonly objectCommas: readonly SourceValue<string>[],
        public readonly directionKeyword: SourceValue<string> | undefined,
        public readonly target: ExpressionNode | undefined,
        public readonly byKeyword: SourceValue<string> | undefined,
        public readonly formats: FormatListNode | undefined,
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.FormattedIoStatement);
        this.adoptAll(objects);
        if (target) this.adopt(target);
        if (formats) this.adopt(formats);
    }
    override documentationProvider(): DocumentationProvider<FormattedIoStatementNode> {
        return FormattedIoStatementNode.provider;
    }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const own = this.lookupOwnSourceValue(position, this.keyword);
        if (own) return own;
        for (const object of this.objects) {
            const hit = object.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.objectCommas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        return this.lookupOwnSourceValue(position, this.directionKeyword)
            ?? this.target?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.byKeyword)
            ?? this.formats?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.semicolon);
    }
    override getChildren(): readonly AstNode[] {
        return [...this.objects, ...(this.target ? [this.target] : []), ...(this.formats ? [this.formats] : [])];
    }
    override dumpLabel(): string {
        return `FormattedIo(${this.keyword.value}${this.directionKeyword ? ' '+this.directionKeyword.value : ''}, ${this.objects.length} data)`;
    }
}
