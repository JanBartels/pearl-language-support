// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Token } from '../../../lexer/token';
import { ActualParameterNode } from '../../../ast/problem/statements/actualParameterNode';
import { ActualParameterListNode } from '../../../ast/problem/statements/actualParameterListNode';
import { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { StatementExpressionParser } from '../expressions/statementExpressionParser';

/** Called after a CALL has already been recognized.
 * Parsing arguments directly avoids token replay and speculative diagnostics.
 */
export class ActualParameterListParser extends ParserBase {
    override parse(): ActualParameterListNode | undefined {
        throw new Error('Use ActualParameterListParser.parseAfterOpenParenthesis().');
    }

    parseAfterOpenParenthesis(openParenthesis: Token): ActualParameterListNode {
        const parameters: ActualParameterNode[] = [];
        const commas: SourceValue<string>[] = [];
        let closeParenthesis: SourceValue<string> | undefined;
        let lastWasComma = false;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.isOperator(')')) {
                closeParenthesis = this.tokenValue(this.current());
                this.next();
                if (lastWasComma) {
                    parameters.push(new ActualParameterNode([]));
                    this.problems.error(this.location(), 'Expected CALL argument after comma.');
                }
                break;
            }
            if (this.isOperator(';') || this.isStatementBoundary()) break;
            if (this.isOperator(',')) {
                this.problems.error(this.location(), 'Expected CALL argument.');
                parameters.push(new ActualParameterNode([]));
                commas.push(this.tokenValue(this.current()));
                this.next();
                lastWasComma = true;
                continue;
            }

            const argument = new StatementExpressionParser(this.context).parseUntil(
                [',', ')'], 'CALL argument'
            );
            parameters.push(new ActualParameterNode(argument.values, argument.expression));
            lastWasComma = false;
            this.skipTrivia();
            const comma = this.acceptOperator(',');
            if (!comma) {
                if (this.isOperator(')')) continue;
                break;
            }
            commas.push(this.tokenValue(comma));
            lastWasComma = true;
        }
        // Empty argument after ',' or a missing closing ')' is preserved as
        // an AST slot, but never counted as a supplied actual parameter.
        if (!closeParenthesis) {
            if (lastWasComma || parameters.length === 0) {
                parameters.push(new ActualParameterNode([]));
                if (lastWasComma) {
                    this.problems.error(this.location(), 'Expected CALL argument after comma.');
                }
            }
            this.problems.error(this.location(), "Expected ')' after CALL arguments.");
        }
        return new ActualParameterListNode(
            this.tokenValue(openParenthesis), parameters, commas, closeParenthesis,
            closeParenthesis ? undefined : this.tokenValue(this.current())
        );
    }

    private isStatementBoundary(): boolean {
        return this.isKeyword([
            'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN',
            'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN', 'GOTO'
        ]);
    }
}
