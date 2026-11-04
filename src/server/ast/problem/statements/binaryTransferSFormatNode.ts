// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { BinaryTransferDocumentationProvider } from '../../../documentation/problem/statements/binaryTransferDocumentationProvider';
import type { NameExpressionNode } from '../expressions/nameExpressionNode';

/** RTOS-UH READ/WRITE BY S(variable): byte count control and result. */
export class BinaryTransferSFormatNode extends AstNode {
    private static readonly provider = new BinaryTransferDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly opening: SourceValue<string> | undefined,
        public readonly variable: NameExpressionNode | undefined,
        public readonly closing: SourceValue<string> | undefined
    ) {
        super(AstKind.BinaryTransferSFormat);
        if (variable) this.adopt(variable);
    }

    override documentationProvider(): DocumentationProvider<BinaryTransferSFormatNode> {
        return BinaryTransferSFormatNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.opening)
            ?? this.variable?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.closing);
    }

    override getChildren(): readonly AstNode[] { return this.variable ? [this.variable] : []; }

    override dumpLabel(): string { return 'BinaryTransferSFormat'; }
}
