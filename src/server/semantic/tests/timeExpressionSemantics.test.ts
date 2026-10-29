// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { AstKind } from '../../ast/astKind';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { AstLookupResultDocumentationProvider } from '../../documentation/astLookupResultDocumentationProvider';
import { CallSignatureIndex } from '../callSignatureIndex';
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
function analyze(program: string) {
    const source = new FileSource('file:///time-expressions.pearl',
        `MODULE M; PROBLEM; ${program} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const returns: ReturnStatementNode[] = [];
    const walk = (node: AstNode) => {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    };
    walk(ast);
    const hover = (fragment: string) => {
        const offset = source.text.indexOf(fragment);
        assert.ok(offset >= 0);
        const lookup = ast.lookupSourceValue({ uri: source.uri, offset });
        assert.ok(lookup);
        return AstLookupResultDocumentationProvider.getDocumentation(
            lookup, semantic, new CallSignatureIndex(ast, semantic, context.activeBlockComments));
    };
    return {
        source, ast, semantic, returns, hover,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

test('CLOCK literals in expressions use existing CLOCK AST and result type', () => {
    const r = analyze(`R: PROC RETURNS(CLOCK); RETURN(12:34:56); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.returns[0].expression?.kind, AstKind.ClockConstant);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!), { kind: SemanticTypeKind.Clock });
});

test('DURATION literals in expressions reuse components and support mixed units', () => {
    const r = analyze(`R: PROC RETURNS(DURATION); RETURN(1 HRS 2 MIN 3 SEC); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.returns[0].expression?.kind, AstKind.DurationConstant);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!), { kind: SemanticTypeKind.Duration });
});

test('temporal expressions type arithmetic and comparisons without statement special cases', () => {
    const r = analyze(`DCL T CLOCK, D DURATION;
      R: PROC RETURNS(CLOCK); RETURN(T + 2 SEC); RETURN(10:20:30 - D); END;
      S: PROC RETURNS(DURATION); RETURN(T - 11:22:33); RETURN(D * 2); RETURN(2 * D); RETURN(D / 2); END;
      Q: PROC RETURNS(BIT(1)); RETURN(T > 12:00:00); RETURN(D == 4 SEC); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const kinds = r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)?.kind);
    assert.deepEqual(kinds, [
        SemanticTypeKind.Clock, SemanticTypeKind.Clock,
        SemanticTypeKind.Duration, SemanticTypeKind.Duration, SemanticTypeKind.Duration, SemanticTypeKind.Duration,
        SemanticTypeKind.Bit, SemanticTypeKind.Bit
    ]);
});

test('unsupported temporal arithmetic is rejected at its operator', () => {
    const r = analyze(`DCL T CLOCK;
       R: PROC RETURNS(CLOCK); RETURN(T + 12:00:00); RETURN(T * 2); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands
    ]);
});

test('invalid CLOCK constant is rejected by existing time evaluator', () => {
    const r = analyze(`R: PROC RETURNS(CLOCK); RETURN(12:80:00); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidClockConstant]);
});

test('malformed DURATION unit order uses existing tail parser diagnostics', () => {
    const r = analyze(`R: PROC RETURNS(DURATION); RETURN(1 MIN 2 HRS); END;`);
    assert.ok(r.syntax.some(problem => /DURATION units/.test(problem)));
});

test('ordinary numbers retain numeric precision and arithmetic', () => {
    const r = analyze(`R: PROC RETURNS(FIXED(31)); RETURN(1(31) + 2); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.returns[0].expression?.kind, AstKind.DyadicExpression);
});

test('CLOCK and DURATION literals show semantic types in hover', () => {
    const r = analyze(`R: PROC RETURNS(CLOCK); RETURN(12:30:00); END;
        S: PROC RETURNS(DURATION); RETURN(4 SEC); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.match(r.hover('12:30:00') ?? '', /Expression type:.*CLOCK/);
    assert.match(r.hover('4 SEC') ?? '', /Expression type:.*DUR/);
});

test('time expressions are analyzed in IF conditions and reject wrong operand types', () => {
    const r = analyze(`DCL T CLOCK; R: PROC;
        IF T > 12:00:00 THEN RETURN; FIN;
        IF T + 3 SEC THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /IF-Bedingung.*BIT\(1\)/);
});

test('CLOCK lookahead does not consume CASE index ranges', () => {
    const r = analyze(`R: PROC; CASE 2 ALT (1:5) RETURN; OUT RETURN; FIN; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('fractional seconds and unary minus on DURATION are regular expressions', () => {
    const r = analyze(`R: PROC RETURNS(DURATION);
        RETURN(-0.5 SEC); RETURN(1 HRS + 2 MIN); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)?.kind),
        [SemanticTypeKind.Duration, SemanticTypeKind.Duration]);
});

test('DURATION divided by DURATION produces FLOAT(31)', () => {
    const r = analyze(`R: PROC RETURNS(FLOAT(31)); RETURN(4 SEC / 2 SEC); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!),
        { kind: SemanticTypeKind.Float, precision: 31 });
});
