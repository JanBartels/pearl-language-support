// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { GlobalAttributeNode } from '../declarations/globalAttributeNode';
import { ProcedureSignatureNode } from '../procedures/procedureSignatureNode';

export class SpcProcedureAttributeNode extends AstNode {
    constructor(
        public readonly colon: SourceValue<string> | undefined,
        public readonly signature: ProcedureSignatureNode,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.SpcProcedureAttribute);
        this.adopt(signature);
        if (global) this.adopt(global);
    }
    override documentationProvider(): undefined { return undefined; }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.colon)
            ?? this.signature.lookupSourceValue(position)
            ?? this.global?.lookupSourceValue(position);
    }
    override getChildren(): readonly AstNode[] {
        return [this.signature, ...(this.global ? [this.global] : [])];
    }
    override dumpLabel(): string { return `SpcProcedureAttribute(${this.signature.keyword.value})`; }
}
