// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { FormalParameterNode } from '../../../ast/problem/declarations/formalParameterNode';
import { ParserBase } from '../../parserBase';
import { OneIdentifierOrListParser } from '../identifiers/oneIdentifierOrListParser';
import { VirtualDimensionListParser } from '../dimensions/virtualDimensionListParser';
import { ProblemDataTypeParser } from '../types/problemDataTypeParser';
import { ProcedureParameterTypeParser } from './procedureParameterTypeParser';

/** FormalParameter ::= [IdentifierOrList [VirtualDimensions]] [INV] ParameterType [IDENT]. */
export class FormalParameterParser extends ParserBase {
    override parse(): FormalParameterNode | undefined {
        this.skipTrivia();
        const identifiers = new OneIdentifierOrListParser(this.context).parse();
        // RTOS-UH permits unnamed formal parameters, e.g. PROC(FLOAT IDENT).
        const dimension = identifiers
            ? new VirtualDimensionListParser(this.context).parse()
            : undefined;
        this.skipTrivia();
        const inv = this.acceptKeyword('INV');

        const type = new ProcedureParameterTypeParser(this.context).parse()
            ?? new ProblemDataTypeParser(this.context).parse();
        if (!type) {
            if (identifiers) {
                this.problems.error(this.location(), 'Expected formal parameter type.');
            }
            return undefined;
        }

        this.skipTrivia();
        const ident = this.acceptKeyword(['IDENT', 'IDENTICAL']);
        return new FormalParameterNode(
            identifiers,
            dimension,
            inv ? this.tokenValue(inv) : undefined,
            type,
            ident ? this.tokenValue(ident) : undefined
        );
    }
}
