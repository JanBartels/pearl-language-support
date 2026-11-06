// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { ExpressionNode } from '../expressions/expressionNode';
import type { FormatListNode } from './formatListNode';
import type { FormatReferenceNode } from './formatReferenceNode';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { FormatItemDocumentationProvider } from '../../../documentation/problem/statements/formatItemDocumentationProvider';

/** Single format or repeated group. Repeat count and format parameters are AST expressions.
 * Only an R(...) operand is a FormatReference, resolved in the format namespace.
 */
export class FormatItemNode extends AstNode {
    private static readonly provider = new FormatItemDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string> | undefined,
        public readonly opening: SourceValue<string> | undefined,
        public readonly argumentsList: readonly ExpressionNode[],
        public readonly argumentCommas: readonly SourceValue<string>[],
        public readonly closing: SourceValue<string> | undefined,
        public readonly reference: FormatReferenceNode | undefined,
        public readonly group: FormatListNode | undefined,
        public readonly repeatOpening: SourceValue<string> | undefined,
        public readonly repeatCount: ExpressionNode | undefined,
        public readonly repeatClosing: SourceValue<string> | undefined
    ) {
        super(AstKind.FormatItem);
        this.adoptAll(argumentsList);
        if (reference) this.adopt(reference);
        if (group) this.adopt(group);
        if (repeatCount) this.adopt(repeatCount);
    }
    override documentationProvider(): DocumentationProvider<FormatItemNode> { return FormatItemNode.provider; }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const source of [this.repeatOpening, this.repeatClosing, this.keyword, this.opening]) {
            const hit = this.lookupOwnSourceValue(position, source);
            if (hit) return hit;
        }
        const repeat = this.repeatCount?.lookupSourceValue(position);
        if (repeat) return repeat;
        for (const arg of this.argumentsList) {
            const hit = arg.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.argumentCommas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        return this.reference?.lookupSourceValue(position)
            ?? this.group?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.closing);
    }
    override getChildren(): readonly AstNode[] {
        return [...(this.repeatCount ? [this.repeatCount] : []), ...this.argumentsList,
            ...(this.reference ? [this.reference] : []), ...(this.group ? [this.group] : [])];
    }
    override dumpLabel(): string {
        return `Format(${this.keyword?.value ?? 'group'}${this.repeatCount ? ', repeated' : ''})`;
    }
}
