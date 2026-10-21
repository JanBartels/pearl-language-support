// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ProcedureSignatureNode } from '../procedures/procedureSignatureNode';

export class ProcedureReferenceTargetNode extends AstNode {
    constructor(public readonly signature: ProcedureSignatureNode) {
        super(AstKind.ProcedureReferenceTarget);
        this.adopt(signature);
    }
    override documentationProvider(): undefined { return undefined; }
    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.signature.lookupSourceValue(offset);
    }
    override getChildren(): readonly AstNode[] { return [this.signature]; }
    override dumpLabel(): string { return 'ProcedureReferenceTarget'; }
}
