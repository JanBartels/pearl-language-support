// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { FormalParameterDocumentationProvider } from '../../../documentation/problem/declarations/formalParameterDocumentationProvider';
import { OneIdentifierOrListNode } from '../identifiers/oneIdentifierOrListNode';
import { VirtualDimensionListNode } from '../dimensions/virtualDimensionListNode';
import { ProblemDataTypeNode } from '../types/problemDataTypeNode';
import { ProcedureParameterTypeNode } from './procedureParameterTypeNode';

export type FormalParameterTypeNode = ProblemDataTypeNode | ProcedureParameterTypeNode;

export class FormalParameterNode extends AstNode {
    private static readonly provider = new FormalParameterDocumentationProvider();

    constructor(
        public readonly identifiers: OneIdentifierOrListNode,
        public readonly dimension: VirtualDimensionListNode | undefined,
        public readonly invKeyword: SourceValue<string> | undefined,
        public readonly type: FormalParameterTypeNode,
        public readonly identKeyword: SourceValue<string> | undefined
    ) {
        super(AstKind.FormalParameter);
        this.adopt(identifiers);
        if (dimension) this.adopt(dimension);
        this.adopt(type);
    }

    override documentationProvider(): DocumentationProvider<FormalParameterNode> {
        return FormalParameterNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        // Bind parameter names to this node, not to the generic identifier-list provider.
        for (const name of this.identifiers.identifiers) {
            const result = this.lookupOwnSourceValue(position, name);
            if (result) return result;
        }
        return this.type.lookupSourceValue(position)
            ?? this.dimension?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.invKeyword)
            ?? this.lookupOwnSourceValue(position, this.identKeyword);
    }

    override getChildren(): readonly AstNode[] {
        return [this.identifiers, ...(this.dimension ? [this.dimension] : []), this.type];
    }

    override dumpLabel(): string {
        return `FormalParameter(${this.identifiers.identifiers.map(n => n.value).join(', ')}${
            this.identKeyword ? ', IDENT' : ''}${this.invKeyword ? ', INV' : ''})`;
    }
}
