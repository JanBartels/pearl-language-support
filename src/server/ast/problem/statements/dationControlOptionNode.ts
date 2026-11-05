// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { DationControlDocumentationProvider } from '../../../documentation/problem/statements/dationControlDocumentationProvider';
import type { ExpressionNode } from '../expressions/expressionNode';

export type DationControlOptionKind =
    'IDF' | 'NEW' | 'OLD' | 'ANY' | 'EXCLUSIVE' | 'CAN' | 'PRM';

/** One OPEN/CLOSE BY option, preserving its argument and punctuation. */
export class DationControlOptionNode extends AstNode {
    private static readonly provider = new DationControlDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly opening: SourceValue<string> | undefined,
        public readonly argument: ExpressionNode | undefined,
        public readonly closing: SourceValue<string> | undefined
    ) {
        super(AstKind.DationControlOption);
        if (argument) this.adopt(argument);
    }

    override documentationProvider(): DocumentationProvider<DationControlOptionNode> {
        return DationControlOptionNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.opening)
            ?? this.argument?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.closing);
    }

    override getChildren(): readonly AstNode[] {
        return this.argument ? [this.argument] : [];
    }

    override dumpLabel(): string {
        return `DationControlOption(${this.keyword.value})`;
    }
}
