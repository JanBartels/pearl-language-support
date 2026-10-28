// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
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
    const source = new FileSource('file:///bounds.pearl', `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const returns: ReturnStatementNode[] = [];
    function walk(node: AstNode): void {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    }
    walk(ast);
    return {
        semantic, returns,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

const fields = `DCL Records(10) STRUCT[Value FIXED, Meta STRUCT[Count FIXED]];
 R2: PROC(I FIXED) RETURNS(FIXED);`;

test('constant out-of-range index in array of STRUCT: Records(11).Value', () => {
    const result = analyze(`${fields} RETURN(Records(11).Value + Records(I).Meta.Count); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
    assert.match(result.errors[0].message, /11.*Records.*1:10/);
    assert.equal(result.semantic.expressionTypes.get(result.returns[0].expression!)?.kind,
        SemanticTypeKind.Fixed);
    assert.equal(result.errors[0].location.source.getText(result.errors[0].location.span), '11');
});

test('exact bounds and nonconstant indices are accepted', () => {
    const result = analyze(`${fields} RETURN(Records(1).Value + Records(10).Value
       + Records(I).Value); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('constant arithmetic and negative values are evaluated without a second parser', () => {
    const result = analyze(`${fields} RETURN(Records((5*2)+1).Value + Records(-1).Value); END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.errors.filter(d => d.code === SemanticDiagnosticCode.ConstantIndexOutOfBounds).length, 2);
    assert.match(result.errors[0].message, /11/);
    assert.match(result.errors[1].message, /-1/);
});

test('custom lower bounds and multiple dimensions are checked independently', () => {
    const result = analyze(`DCL Table(-2:3, 4:7) FIXED;
       R: PROC RETURNS(FIXED); RETURN(Table(-3, 8)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.errors.filter(d => d.code === SemanticDiagnosticCode.ConstantIndexOutOfBounds).length, 2);
    assert.match(result.errors[0].message, /Dimension 1.*-2:3/);
    assert.match(result.errors[1].message, /Dimension 2.*4:7/);
});

test('named INV FIXED constants are evaluated; initialized mutable variables are not', () => {
    const result = analyze(`DCL Upper INV FIXED INIT(11), RunTime FIXED INIT(11), A(10) FIXED;
       R: PROC RETURNS(FIXED); RETURN(A(Upper) + A(RunTime)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
    assert.match(result.errors[0].message, /11.*A/);
});

test('virtual array parameters have no static bounds', () => {
    const result = analyze(`R: PROC(A(,) FIXED IDENT, I FIXED) RETURNS(FIXED);
       RETURN(A(999)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.errors.some(d => d.code === SemanticDiagnosticCode.ConstantIndexOutOfBounds), false);
});

test('CHAR and BIT selectors support index expressions and check explicit lengths', () => {
    const result = analyze(`DCL Text CHAR(4), Bits BIT(8);
       R: PROC RETURNS(CHAR(1)); RETURN(Text.CHAR(5)); END;
       S: PROC RETURNS(BIT(1)); RETURN(Bits.BIT(9)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.errors.filter(d => d.code === SemanticDiagnosticCode.ConstantIndexOutOfBounds).length, 2);
    assert.match(result.errors[0].message, /CHAR.*1:4/);
    assert.match(result.errors[1].message, /BIT.*1:8/);
    assert.deepEqual(result.returns.map(r => result.semantic.expressionTypes.get(r.expression!)?.kind),
        [SemanticTypeKind.Character, SemanticTypeKind.Bit]);
});

test('lower bound one for selectors is known even if declared length is implicit', () => {
    const result = analyze(`DCL Text CHAR, Bits BIT;
       R: PROC RETURNS(CHAR); RETURN(Text.CHAR(0)); END;
       S: PROC RETURNS(BIT); RETURN(Bits.BIT(-2)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.errors.filter(d => d.code === SemanticDiagnosticCode.ConstantIndexOutOfBounds).length, 2);
});

test('dynamic selector indices do not generate diagnostics', () => {
    const result = analyze(`DCL Text CHAR(4), Bits BIT(8);
       R: PROC(I FIXED) RETURNS(CHAR(1)); RETURN(Text.CHAR(I)); END;
       S: PROC(I FIXED) RETURNS(BIT(1)); RETURN(Bits.BIT(I+1)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('selector wrong type and count have their own diagnostics', () => {
    const result = analyze(`DCL Text CHAR(4), Bits BIT(8);
       R: PROC RETURNS(CHAR(1)); RETURN(Text.CHAR(1.5)); END;
       S: PROC RETURNS(BIT(1)); RETURN(Bits.BIT(1,2)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidStringSelectorIndexType,
        SemanticDiagnosticCode.InvalidStringSelectorIndexCount
    ]);
});

test('invalid expression in index does not generate a range follow-on', () => {
    const result = analyze(`${fields} RETURN(Records(1.5).Value); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidArrayIndexType]);
});

test('string selector after STRUCT and array selection checks the selected component length', () => {
    const result = analyze(`TYPE Packet STRUCT[Payload CHAR(3), Flags BIT(4)];
       DCL Packets(2) Packet;
       R: PROC RETURNS(CHAR(1)); RETURN(Packets(1).Payload.CHAR(4)); END;
       S: PROC RETURNS(BIT(1)); RETURN(Packets(2).Flags.BIT(5)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.ConstantIndexOutOfBounds,
        SemanticDiagnosticCode.ConstantIndexOutOfBounds
    ]);
    assert.match(result.errors[0].message, /CHAR.*1:3/);
    assert.match(result.errors[1].message, /BIT.*1:4/);
});

test('valid CHAR and BIT selections can contribute to expression typing', () => {
    const result = analyze(`DCL B BIT(4), C CHAR(3);
       R: PROC RETURNS(BIT(1)); RETURN(B.BIT(4) AND '1'B); END;
       S: PROC RETURNS(CHAR(1)); RETURN(C.CHARACTER(3)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.returns.map(r => result.semantic.expressionTypes.get(r.expression!)?.kind),
        [SemanticTypeKind.Bit, SemanticTypeKind.Character]);
});
