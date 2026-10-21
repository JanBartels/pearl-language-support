// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { ProcedureSignatureDocumentationProvider }
    from '../../../documentation/problem/procedures/procedureSignatureDocumentationProvider';
import { ProblemDataTypeNode } from '../types/problemDataTypeNode';
import { ProcedureSpecificationParameterNode } from './procedureSpecificationParameterNode';

/** Shared signature grammar for SPC ENTRY/PROC and REF PROC. */
export class ProcedureSignatureNode extends AstNode {
    private static readonly provider = new ProcedureSignatureDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly parameters: readonly ProcedureSpecificationParameterNode[],
        public readonly returnsKeyword: SourceValue<string> | undefined,
        public readonly resultType: ProblemDataTypeNode | undefined
    ) {
        super(AstKind.ProcedureSignature);
        this.adoptAll(parameters);
        if (resultType) this.adopt(resultType);
    }
    override documentationProvider(): DocumentationProvider<ProcedureSignatureNode> {
        return ProcedureSignatureNode.provider;
    }
    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.parameters.map(p => p.lookupSourceValue(offset)).find(Boolean)
            ?? this.lookupOwnSourceValue(offset, this.returnsKeyword)
            ?? this.resultType?.lookupSourceValue(offset);
    }
    override getChildren(): readonly AstNode[] {
        return [...this.parameters, ...(this.resultType ? [this.resultType] : [])];
    }
    override dumpLabel(): string {
        return `ProcedureSignature(${this.keyword.value}, ${this.parameters.length} parameters${
            this.returnsKeyword ? ', RETURNS' : ''})`;
    }
}
