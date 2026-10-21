// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ProcedureSignatureNode } from '../../../ast/problem/procedures/procedureSignatureNode';
import { ProcedureSpecificationParameterNode }
    from '../../../ast/problem/procedures/procedureSpecificationParameterNode';
import { ParserBase } from '../../parserBase';
import { ProblemDataTypeParser } from '../types/problemDataTypeParser';
import { ProcedureSpecificationParameterParser } from './procedureSpecificationParameterParser';

/** A single signature grammar shared by SPC ENTRY/PROC and REF PROC. */
export class ProcedureSignatureParser extends ParserBase {
    override parse(): ProcedureSignatureNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['PROC', 'PROCEDURE', 'ENTRY', 'ENTRY_C', 'PROC_C', 'PROCEDURE_C']);
        if (!keyword) return undefined;

        const parameters = this.parseParameters();
        this.skipTrivia();
        const returns = this.acceptKeyword('RETURNS');
        let resultType;
        if (returns) {
            this.expectLeftParenthesis("Expected '(' after RETURNS.");
            resultType = new ProblemDataTypeParser(this.context).parse();
            if (!resultType) this.problems.error(this.location(), 'Expected procedure result type.');
            if (!this.expectRightParenthesis("Expected ')' after procedure result type.")) {
                this.synchronize([')', 'GLOBAL', ',', ';', 'END', 'MODEND']);
                this.acceptRightParenthesis();
            }
        }
        return new ProcedureSignatureNode(
            this.tokenValue(keyword), parameters,
            returns ? this.tokenValue(returns) : undefined, resultType
        );
    }

    private parseParameters(): ProcedureSpecificationParameterNode[] {
        const parameters: ProcedureSpecificationParameterNode[] = [];
        if (!this.acceptLeftParenthesis()) return parameters;
        if (this.acceptRightParenthesis()) return parameters;

        while (!this.eof()) {
            const checkpoint = this.problemCheckpoint();
            const parameter = new ProcedureSpecificationParameterParser(this.context).parse();
            if (parameter) parameters.push(parameter);
            else {
                if (!this.hasProblemsSince(checkpoint)) {
                    this.problems.error(this.location(), 'Expected procedure signature parameter.');
                }
                this.synchronize([',', ')', ';', 'GLOBAL', 'RETURNS', 'END', 'MODEND']);
            }
            this.skipTrivia();
            if (this.acceptComma()) continue;
            if (this.acceptRightParenthesis()) return parameters;
            this.problems.error(this.location(), "Expected ',' or ')' in procedure signature.");
            this.synchronize([',', ')', ';', 'GLOBAL', 'RETURNS', 'END', 'MODEND']);
            if (this.acceptComma()) continue;
            this.acceptRightParenthesis();
            return parameters;
        }
        return parameters;
    }
}
