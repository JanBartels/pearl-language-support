// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ProcedureParameterTypeNode } from '../../../ast/problem/declarations/procedureParameterTypeNode';
import { ParserBase } from '../../parserBase';

/** Special formal parameter types not represented by ProblemDataTypeNode. */
export class ProcedureParameterTypeParser extends ParserBase {
    override parse(): ProcedureParameterTypeNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword([
            'SEMA', 'BOLT', 'IRPT', 'INTERRUPT', 'SIGNAL', 'DATION'
        ]);
        if (!keyword) return undefined;

        const qualifiers = [];
        if (this.tokenText(keyword) === 'DATION') {
            this.skipTrivia();
            // RTOS-UH also uses DATION ALPHIC without an explicit direction.
            const direction = this.acceptKeyword(['IN', 'OUT', 'INOUT']);
            if (direction) qualifiers.push(this.tokenValue(direction));
            this.skipTrivia();
            const dationClass = this.expectKeyword(['ALPHIC', 'BASIC', 'ALL'],
                'Expected DATION class after direction.');
            if (dationClass) qualifiers.push(this.tokenValue(dationClass));
        }
        return new ProcedureParameterTypeNode(this.tokenValue(keyword), qualifiers);
    }
}
