// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { VirtualDimensionListNode } from '../dimensions/virtualDimensionListNode';
import { FormalParameterTypeNode } from '../declarations/formalParameterNode';

/** Optional parameter name in an SPC/REF PROC signature is documentation, not a declaration. */
export class ProcedureSpecificationParameterNode extends AstNode {
    constructor(
        public readonly name: SourceValue<string> | undefined,
        public readonly dimensions: VirtualDimensionListNode | undefined,
        public readonly type: FormalParameterTypeNode,
        public readonly ident: SourceValue<string> | undefined
    ) {
        super(AstKind.ProcedureSpecificationParameter);
        if (dimensions) this.adopt(dimensions);
        this.adopt(type);
    }

    override documentationProvider(): undefined { return undefined; }
    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.name)
            ?? this.dimensions?.lookupSourceValue(offset)
            ?? this.type.lookupSourceValue(offset)
            ?? this.lookupOwnSourceValue(offset, this.ident);
    }
    override getChildren(): readonly AstNode[] {
        return [...(this.dimensions ? [this.dimensions] : []), this.type];
    }
    override dumpLabel(): string {
        return `ProcedureSpecificationParameter(${this.name?.value ?? '-'}${this.ident ? ', IDENT' : ''})`;
    }
}
