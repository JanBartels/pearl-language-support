// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { CallStatementDocumentationProvider }
    from '../../../documentation/problem/statements/callStatementDocumentationProvider';
import { ActualParameterListNode } from './actualParameterListNode';

/** [CALL] target [ '(' actual parameter expressions ')' ] ';'. */
export class CallStatementNode extends AstNode {
    private static readonly provider = new CallStatementDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string> | undefined,
        public readonly target: SourceValue<string> | undefined,
        public readonly actualParameters: ActualParameterListNode | undefined
    ) {
        super(AstKind.CallStatement);
        if (actualParameters) this.adopt(actualParameters);
    }

    /** Existing semantic representation, derived without discarding AST syntax. */
    get argumentsList(): readonly (readonly SourceValue<string>[])[] | undefined {
        return this.actualParameters?.argumentsList;
    }

    override documentationProvider(): DocumentationProvider<CallStatementNode> {
        return CallStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.target)
            ?? this.actualParameters?.lookupSourceValue(position);
    }

    override getChildren(): readonly AstNode[] {
        return this.actualParameters ? [this.actualParameters] : [];
    }

    override dumpLabel(): string {
        return `CallStatement(${this.target?.value ?? '?'}, ${this.argumentsList?.length ?? 0} arguments)`;
    }
}
