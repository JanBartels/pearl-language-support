// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { CallStatementDocumentationProvider }
    from '../../../documentation/problem/statements/callStatementDocumentationProvider';

/** CALL target [ '(' actual parameter expressions ')' ] ';'. */
export class CallStatementNode extends AstNode {
    private static readonly provider = new CallStatementDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string> | undefined,
        public readonly target: SourceValue<string> | undefined,
        public readonly argumentsList: readonly (readonly SourceValue<string>[])[] | undefined
    ) { super(AstKind.CallStatement); }
    override documentationProvider(): DocumentationProvider<CallStatementNode> {
        return CallStatementNode.provider;
    }
    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        for (const source of [this.keyword, this.target, ...(this.argumentsList?.flat() ?? [])]) {
            const found = this.lookupOwnSourceValue(offset, source);
            if (found) return found;
        }
        return undefined;
    }
    override getChildren(): readonly AstNode[] { return []; }
    override dumpLabel(): string {
        return `CallStatement(${this.target?.value ?? '?'}, ${this.argumentsList?.length ?? 0} arguments)`;
    }
}
