// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { NameExpressionNode } from '../../ast/problem/expressions/nameExpressionNode';
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
import { CallSignatureIndex } from '../callSignatureIndex';
import { AstLookupResultDocumentationProvider } from '../../documentation/astLookupResultDocumentationProvider';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const source = new FileSource('file:///expression-compiler-regression.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const returns: ReturnStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    const hover = (fragment: string, offset = 0) => {
        const position = { uri: source.uri, offset: source.text.indexOf(fragment) + offset };
        const lookup = ast.lookupSourceValue(position);
        assert.ok(lookup, `No AST element at ${fragment}`);
        const signatures = new CallSignatureIndex(ast, semantic, context.activeBlockComments);
        return AstLookupResultDocumentationProvider.getDocumentation(lookup, semantic, signatures);
    };
    return { source, ast, semantic, returns, hover,
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error) };
}

test('RETURN(NIL) is accepted for a reference result with a named target type', () => {
    const r = analyze(`TYPE HS STRUCT[Value FIXED];
        NP: PROC RETURNS(REF HS); RETURN(NIL); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.returns[0].expression?.dumpLabel(), 'LiteralExpression(NIL)');
});

test('NIL is also accepted for a reference result through a TYPE alias', () => {
    const r = analyze(`TYPE HS STRUCT[Value FIXED]; TYPE Ptr REF HS;
        NP: PROC RETURNS(Ptr); RETURN((NIL)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('RETURN(NIL) is rejected for a scalar result at the NIL literal', () => {
    const r = analyze('R: PROC RETURNS(FIXED); RETURN(NIL); END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidReturnType]);
    assert.equal(r.source.text.slice(r.errors[0].location.span.start, r.errors[0].location.span.end), 'NIL');
});

test('LEN and MID are typed through builtin catalog and documented in hover', () => {
    const r = analyze(`DCL Text CHAR(20); DCL (Start, EndIndex) FIXED;
        R: PROC RETURNS(FIXED); RETURN(LEN(Text)); END;
        R2: PROC RETURNS(CHAR(255)); RETURN(MID(Text, Start, EndIndex)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[1].expression!),
        { kind: SemanticTypeKind.Character, length: 255 });
    assert.match(r.hover('LEN(Text)')!, /RTOS-UH-Einbaufunktion/);
    assert.match(r.hover('LEN(Text)')!, /Text CHAR\(\*\) IDENT/);
    assert.match(r.hover('LEN(Text)')!, /Expression type/);
    assert.match(r.hover('MID(Text, Start, EndIndex)')!, /String.*Teilstring|Teilstring extrahieren/);
    const name = r.returns[0].expression as NameExpressionNode;
    assert.ok(r.semantic.builtinBindings.get(name.segments[0].identifier));
    assert.equal(r.semantic.bindings.has(name.segments[0].identifier), false);
});

test('ST accesses DATION through the shared builtin catalog', () => {
    const r = analyze(`SPC File DATION INOUT ALPHIC GLOBAL;
        R: PROC RETURNS(FIXED); RETURN(ST(File)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.match(r.hover('ST(File)')!, /Status einer Datenstation/);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
});

test('invalid builtin arity and argument types have specific diagnostics', () => {
    const r = analyze(`DCL Text CHAR(10); R: PROC RETURNS(FIXED);
        RETURN(LEN()); RETURN(LEN(3)); RETURN(LEN(Text)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidCallArity,
        SemanticDiagnosticCode.InvalidBuiltinArgumentType
    ]);
});

test('user-defined function shadows intrinsic name', () => {
    const r = analyze(`LEN: PROC(I FIXED) RETURNS(FIXED); RETURN(I); END;
        R: PROC RETURNS(FIXED); RETURN(LEN(3)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.semantic.builtinBindings.size, 0);
    assert.doesNotMatch(r.hover('LEN(3)')!, /RTOS-UH-Einbaufunktion/);
});

test('IF expressions are explicitly unsupported in RETURN', () => {
    const r = analyze(`R: PROC RETURNS(FIXED); RETURN(IF 1 == 1 THEN 1 ELSE 2 FIN); END;`);
    assert.ok(r.syntax.some(message => /IF-Ausdrücke.*nicht unterstützt/.test(message)));
});

test('IF expressions are explicitly unsupported in buffered WHILE expressions', () => {
    const r = analyze(`R: PROC; WHILE (IF 1 == 1 THEN '1'B ELSE '0'B FIN)
        REPEAT RETURN; END; END;`);
    assert.ok(r.syntax.some(message => /IF-Ausdrücke.*nicht unterstützt/.test(message)));
});


test('parentheses around NIL preserve the reference return rule', () => {
    const r = analyze('R: PROC RETURNS(REF FIXED); RETURN((NIL)); END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('parentheses around NIL do not hide a scalar return mismatch', () => {
    const r = analyze('R: PROC RETURNS(FIXED); RETURN((NIL)); END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidReturnType]);
});
