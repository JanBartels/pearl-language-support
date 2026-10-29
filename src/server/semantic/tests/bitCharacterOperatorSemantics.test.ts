// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { DyadicExpressionNode } from '../../ast/problem/expressions/dyadicExpressionNode';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string) {
    const source = new FileSource('file:///bit-char-operator-semantics.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root);
    const returns: ReturnStatementNode[] = [];
    function walk(node: AstNode): void {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    }
    walk(root);
    return {
        semantic, returns,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(diagnostic =>
            diagnostic.severity === SemanticDiagnosticSeverity.Error)
    };
}

function resultTypes(result: ReturnType<typeof analyze>) {
    return result.returns.map(ret => result.semantic.expressionTypes.get(ret.expression!));
}

function invalidOperators(result: ReturnType<typeof analyze>) {
    assert.deepEqual(result.errors.map(error => error.code),
        result.errors.map(() => SemanticDiagnosticCode.InvalidExpressionOperands));
    return result.errors.map(error => error.location.source.getText(error.location.span));
}

test('SHIFT preserves BIT length for FIXED shift distance', () => {
    const r = analyze(`R: PROC RETURNS(BIT(16)); RETURN('10110011'B SHIFT 2); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), [{ kind: SemanticTypeKind.Bit, length: 8 }]);
});

test('CSHIFT and <> are the same cyclic shift operation', () => {
    const r = analyze(`R: PROC RETURNS(BIT(16));
        RETURN('1010'B CSHIFT -2);
        RETURN('1010'B <> 2);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), [
        { kind: SemanticTypeKind.Bit, length: 4 },
        { kind: SemanticTypeKind.Bit, length: 4 }
    ]);
});

test('SHIFT rejects non-BIT lhs and non-FIXED rhs at the operator', () => {
    const r = analyze(`R: PROC RETURNS(BIT(16));
        RETURN('AB' SHIFT 2);
        RETURN('1010'B SHIFT 2.0);
        RETURN(1 CSHIFT 2);
        RETURN('1010'B <> '1'B);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(invalidOperators(r), ['SHIFT', 'SHIFT', 'CSHIFT', '<>']);
});

test('character concatenation works for CAT and >< and sums known lengths', () => {
    const r = analyze(`R: PROC RETURNS(CHAR(20));
        RETURN('AB' CAT 'XYZ');
        RETURN('AB' >< 'C');
        RETURN('A' CAT 'B' >< 'C');
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), [
        { kind: SemanticTypeKind.Character, length: 5 },
        { kind: SemanticTypeKind.Character, length: 3 },
        { kind: SemanticTypeKind.Character, length: 3 }
    ]);
});

test('RTOS-UH rejects BIT concatenation for both CAT and ><', () => {
    const r = analyze(`R: PROC RETURNS(BIT(16));
        RETURN('1010'B CAT '11'B);
        RETURN('1010'B >< '11'B);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.UnsupportedBitConcatenation,
        SemanticDiagnosticCode.UnsupportedBitConcatenation
    ]);
    assert.deepEqual(r.errors.map(d => d.location.source.getText(d.location.span)), ['CAT', '><']);
    assert.ok(r.errors.every(d => d.message.includes('RTOS-UH')));
});

test('CAT rejects mixed CHAR/BIT and numeric operands', () => {
    const r = analyze(`R: PROC RETURNS(CHAR(20));
        RETURN('A' CAT '1'B);
        RETURN(1 >< 'B');
        RETURN('C' >< 5);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(invalidOperators(r), ['CAT', '><', '><']);
});

test('TYPE aliases are resolved for both concatenation and shifting', () => {
    const r = analyze(`TYPE Label CHAR(4);
        TYPE Mask BIT(8);
        R: PROC(C Label, B Mask) RETURNS(CHAR(20));
            RETURN(C CAT 'X');
            IF (B SHIFT 1) == B THEN RETURN('ok'); FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), [
        { kind: SemanticTypeKind.Character, length: 5 },
        { kind: SemanticTypeKind.Character, length: 2 }
    ]);
});

test('unknown CHAR lengths remain unknown in CAT results', () => {
    const r = analyze(`R: PROC(C CHAR) RETURNS(CHAR(20)); RETURN(C CAT 'X'); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), [{ kind: SemanticTypeKind.Character, length: undefined }]);
});

test('unknown BIT lengths remain unknown for SHIFT results', () => {
    const r = analyze(`R: PROC(B BIT) RETURNS(BIT(16)); RETURN(B SHIFT 1); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), [{ kind: SemanticTypeKind.Bit, length: undefined }]);
});

test('existing AND/OR/EXOR use maximum BIT length; NOT retains length', () => {
    const r = analyze(`R: PROC RETURNS(BIT(16));
        RETURN('1010'B AND '01'B);
        RETURN('1010'B OR '01'B);
        RETURN('1010'B EXOR '01'B);
        RETURN(NOT '1010'B);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(resultTypes(r), Array(4).fill({ kind: SemanticTypeKind.Bit, length: 4 }));
});

test('bit shifts integrate with existing IF and RETURN operators', () => {
    const r = analyze(`R: PROC(B BIT(8));
        IF ((B CSHIFT 2) AND '00000001'B) == '00000001'B THEN
            RETURN;
        FIN;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('typed result is attached to the dyadic AST node without rewriting it', () => {
    const r = analyze(`R: PROC RETURNS(CHAR(20)); RETURN('A' CAT 'BC'); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const node = r.returns[0].expression;
    assert.ok(node instanceof DyadicExpressionNode);
    assert.equal(node.operator.value, 'CAT');
    assert.deepEqual(r.semantic.expressionTypes.get(node),
        { kind: SemanticTypeKind.Character, length: 3 });
});


test('negative SHIFT distance requires parentheses in RETURN expressions', () => {
    const invalid = analyze(`R: PROC RETURNS(BIT(16));
        DCL B16 BIT(16);
        RETURN(B16 SHIFT -2);
    END;`);
    assert.deepEqual(invalid.syntax, [
        'Negativer SHIFT-Abstand muss geklammert werden: SHIFT (-2).'
    ]);
    const valid = analyze(`R: PROC RETURNS(BIT(16));
        DCL B16 BIT(16);
        RETURN(B16 SHIFT (-2));
    END;`);
    assert.deepEqual(valid.syntax, []);
    assert.deepEqual(valid.errors, []);
    assert.deepEqual(resultTypes(valid), [{ kind: SemanticTypeKind.Bit, length: 16 }]);
});
