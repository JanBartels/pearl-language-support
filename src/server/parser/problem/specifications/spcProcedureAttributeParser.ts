// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcProcedureAttributeNode } from '../../../ast/problem/specifications/spcProcedureAttributeNode';
import { ParserBase } from '../../parserBase';
import { GlobalAttributeParser } from '../declarations/globalAttributeParser';
import { ProcedureSignatureParser } from '../procedures/procedureSignatureParser';

export class SpcProcedureAttributeParser extends ParserBase {
    override parse(): SpcProcedureAttributeNode | undefined {
        this.skipTrivia();
        const colon = this.isOperator(':') ? this.acceptOperator(':') : undefined;
        const signature = new ProcedureSignatureParser(this.context).parse();
        if (!signature) {
            if (colon) this.problems.error(this.location(), 'Expected PROC after SPC colon.');
            return undefined;
        }
        const global = new GlobalAttributeParser(this.context).parse();
        return new SpcProcedureAttributeNode(
            colon ? this.tokenValue(colon) : undefined, signature, global
        );
    }
}
