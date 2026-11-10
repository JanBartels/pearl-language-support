// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { BasicTransferDocumentationProvider } from '../../../documentation/problem/statements/basicTransferDocumentationProvider';
import type { ExpressionNode } from '../expressions/expressionNode';
import type { NameExpressionNode } from '../expressions/nameExpressionNode';

/** RTOS-UH TAKE/SEND: optional, possibly multi-element list and BASIC DATION.
 * The BY clause of the language report is not supported by RTOS-UH; an
 * encountered BY token is retained for lookup while the parser recovers.
 */
export class BasicTransferStatementNode extends AstNode {
    private static readonly provider = new BasicTransferDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly objects: readonly ExpressionNode[],
        public readonly commas: readonly SourceValue<string>[],
        public readonly directionKeyword: SourceValue<string> | undefined,
        public readonly dation: NameExpressionNode | undefined,
        public readonly unsupportedBy: SourceValue<string> | undefined,
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.BasicTransferStatement);
        this.adoptAll(objects);
        if (dation) this.adopt(dation);
    }

    override documentationProvider(): DocumentationProvider<BasicTransferStatementNode> {
        return BasicTransferStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const own = this.lookupOwnSourceValue(position, this.keyword);
        if (own) return own;
        for (const object of this.objects) {
            const hit = object.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.commas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        return this.lookupOwnSourceValue(position, this.directionKeyword)
            ?? this.dation?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.unsupportedBy)
            ?? this.lookupOwnSourceValue(position, this.semicolon);
    }

    override getChildren(): readonly AstNode[] {
        return this.dation ? [...this.objects, this.dation] : [...this.objects];
    }

    override dumpLabel(): string {
        return `BasicTransferStatement(${this.keyword.value}, ${this.objects.length} objects)`;
    }
}
