// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { ProblemDataTypeNode } from '../../../ast/problem/types/problemDataTypeNode';
import { FormalParameterNode } from '../../../ast/problem/declarations/formalParameterNode';
import { ProcedureDeclarationNode } from '../../../ast/problem/declarations/procedureDeclarationNode';
import { TailParser } from '../../tailParser';
import { ProblemDataTypeParser } from '../types/problemDataTypeParser';
import { FormalParameterParser } from './formalParameterParser';
import { GlobalAttributeParser } from './globalAttributeParser';
import { BodyParser } from '../statements/bodyParser';

export class ProcedureDeclarationTailParser extends TailParser {
    parseTail(name: SourceValue<string>): ProcedureDeclarationNode {
        const proc = this.expectKeyword(['PROC', 'PROCEDURE'],
            'Expected PROC after procedure name.');
        if (!proc) throw new Error('ProcedureDeclarationTailParser requires PROC.');

        const parameters = this.parseParameterList();
        this.skipTrivia();
        const returns = this.acceptKeyword('RETURNS');
        let resultType: ProblemDataTypeNode | undefined;
        if (returns) {
            this.expectLeftParenthesis("Expected '(' after RETURNS.");
            resultType = new ProblemDataTypeParser(this.context).parse();
            if (!resultType) {
                this.problems.error(this.location(), 'Expected procedure result type.');
            }
            if (!this.expectRightParenthesis("Expected ')' after result type.")) {
                this.synchronize([')', 'GLOBAL', ';', 'END', 'MODEND']);
                this.acceptRightParenthesis();
            }
        }

        const global = new GlobalAttributeParser(this.context).parse();
        if (!this.expectSemicolon("Expected ';' after PROC declaration.")) {
            this.synchronize([
                ';', 'TYPE', 'DCL', 'DECLARE', 'SPC', 'SPECIFY',
                'BEGIN', 'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'END', 'MODEND'
            ]);
            this.acceptSemicolon();
        }

        const body = new BodyParser(this.context).parseBody();
        this.skipTrivia();
        const end = this.acceptKeyword('END');
        if (!end) {
            this.problems.error(this.location(), "Expected 'END' after PROC body.");
        } else {
            this.expectSemicolon("Expected ';' after PROC END.");
        }
        return new ProcedureDeclarationNode(
            name, this.tokenValue(proc), parameters,
            returns ? this.tokenValue(returns) : undefined,
            resultType, global, body,
            end ? this.tokenValue(end) : undefined
        );
    }

    private parseParameterList(): FormalParameterNode[] {
        const parameters: FormalParameterNode[] = [];
        if (!this.acceptLeftParenthesis()) return parameters;
        this.skipTrivia();
        if (this.acceptRightParenthesis()) return parameters;

        while (!this.eof()) {
            const checkpoint = this.problemCheckpoint();
            const parameter = new FormalParameterParser(this.context).parse();
            if (parameter) {
                parameters.push(parameter);
            } else {
                if (!this.hasProblemsSince(checkpoint)) {
                    this.problems.error(this.location(), 'Expected formal parameter.');
                }
                this.synchronize([',', ')', ';', 'RETURNS', 'GLOBAL', 'END', 'MODEND']);
            }

            this.skipTrivia();
            if (this.acceptComma()) continue;
            if (this.acceptRightParenthesis()) return parameters;
            this.problems.error(this.location(), "Expected ',' or ')' in formal parameter list.");
            this.synchronize([',', ')', ';', 'RETURNS', 'GLOBAL', 'END', 'MODEND']);
            if (this.acceptComma()) continue;
            this.acceptRightParenthesis();
            return parameters;
        }
        return parameters;
    }
}
