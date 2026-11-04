// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { BinaryTransferDocumentationProvider } from '../../../documentation/problem/statements/binaryTransferDocumentationProvider';
import type { ExpressionNode } from '../expressions/expressionNode';
import type { BinaryTransferSFormatNode } from './binaryTransferSFormatNode';

/** RTOS-UH READ/WRITE: an ordered object list and optional ordered S controls. */
export class BinaryTransferStatementNode extends AstNode {
    private static readonly provider = new BinaryTransferDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly objects: readonly ExpressionNode[],
        public readonly objectCommas: readonly SourceValue<string>[],
        public readonly directionKeyword: SourceValue<string> | undefined,
        public readonly dation: ExpressionNode | undefined,
        public readonly byKeyword: SourceValue<string> | undefined,
        public readonly formats: readonly BinaryTransferSFormatNode[],
        public readonly formatCommas: readonly SourceValue<string>[],
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.BinaryTransferStatement);
        this.adoptAll(objects);
        if (dation) this.adopt(dation);
        this.adoptAll(formats);
    }

    override documentationProvider(): DocumentationProvider<BinaryTransferStatementNode> {
        return BinaryTransferStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const own = this.lookupOwnSourceValue(position, this.keyword);
        if (own) return own;
        for (const value of this.objects) {
            const hit = value.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.objectCommas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        const middle = this.lookupOwnSourceValue(position, this.directionKeyword)
            ?? this.dation?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.byKeyword);
        if (middle) return middle;
        for (const format of this.formats) {
            const hit = format.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.formatCommas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        return this.lookupOwnSourceValue(position, this.semicolon);
    }

    override getChildren(): readonly AstNode[] {
        return this.dation ? [...this.objects, this.dation, ...this.formats]
            : [...this.objects, ...this.formats];
    }

    override dumpLabel(): string {
        return `BinaryTransferStatement(${this.keyword.value}, ${this.objects.length} objects, ${this.formats.length} S)`;
    }
}
