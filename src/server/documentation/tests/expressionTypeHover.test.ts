// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import type { SemanticContext } from '../../semantic/semanticContext';
import { SemanticDiagnosticSeverity } from '../../semantic/semanticDiagnostic';
import { FileSource } from '../../source/fileSource';
import type { AstNode } from '../../ast/astNode';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { AstLookupResultDocumentationProvider } from '../astLookupResultDocumentationProvider';

const logger: Logger = { info() {}, warn() {}, error() {} };

function build(body: string) {
    const source = new FileSource('file:///expression-hover.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const lexer = new Lexer(source, problems, logger);
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(lexer.tokenize(), source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    assert.deepEqual(problems.toArray().map(p => p.message), []);
    return { source, ast, semantic };
}

function hoverAt(
    source: FileSource, ast: AstNode, semantic: SemanticContext | undefined,
    text: string, within: string, offsetInWithin: number
): string | undefined {
    const start = source.text.indexOf(within);
    assert.ok(start >= 0, `Missing source fragment: ${within}`);
    assert.equal(source.text.substring(start, start + within.length), within);
    const position = { uri: source.uri, offset: start + offsetInWithin };
    const result = ast.lookupSourceValue(position);
    assert.ok(result, `Missing AST lookup at: ${text}`);
    return AstLookupResultDocumentationProvider.getDocumentation(result, semantic);
}

test('RETURN arithmetic shows operand and operator types via AST hover', () => {
    const { source, ast, semantic } = build(`RetTest: PROC(A FIXED) RETURNS(FIXED);
        RETURN(A + 2*3); END;`);
    assert.deepEqual(semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error), []);
    const fragment = 'A + 2*3';
    const name = hoverAt(source, ast, semantic, 'A', fragment, 0);
    assert.match(name!, /\*\*Symbol:\*\* parameter/);
    assert.match(name!, /\*\*Type:\*\* `FIXED`/);
    assert.match(name!, /\*\*Expression type:\*\* `FIXED`/);
    const plus = hoverAt(source, ast, semantic, '+', fragment, 2);
    assert.match(plus!, /# Dyadic operator/);
    assert.match(plus!, /\*\*Expression type:\*\* `FIXED\(15\)`/);
    const times = hoverAt(source, ast, semantic, '*', fragment, 5);
    assert.match(times!, /\*\*Expression type:\*\* `FIXED\(15\)`/);
    const literal = hoverAt(source, ast, semantic, '2', fragment, 4);
    assert.match(literal!, /# Literal/);
    assert.match(literal!, /\*\*Expression type:\*\* `FIXED\(15\)`/);
});

test('Hover distinguishes declared FIXED operand from FLOAT expression result', () => {
    const { source, ast, semantic } = build(`F: PROC(A FIXED) RETURNS(FLOAT);
        RETURN(A + 1.5); END;`);
    assert.deepEqual(semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error), []);
    const name = hoverAt(source, ast, semantic, 'A', 'A + 1.5', 0);
    const operator = hoverAt(source, ast, semantic, '+', 'A + 1.5', 2);
    assert.match(name!, /\*\*Expression type:\*\* `FIXED`/);
    assert.match(operator!, /\*\*Expression type:\*\* `FLOAT\(23\)`/);
});

test('Monadic and grouped expressions expose their own inferred type', () => {
    const { source, ast, semantic } = build(`F: PROC(A FIXED) RETURNS(FIXED);
        RETURN(-(A + 1)); END;`);
    const within = '-(A + 1)';
    const minus = hoverAt(source, ast, semantic, '-', within, 0);
    const opening = hoverAt(source, ast, semantic, '(', within, 1);
    const plus = hoverAt(source, ast, semantic, '+', within, 4);
    assert.match(minus!, /# Monadic operator/);
    assert.match(minus!, /\*\*Expression type:\*\* `FIXED\(15\)`/);
    assert.match(opening!, /# Parenthesized expression/);
    assert.match(opening!, /\*\*Expression type:\*\* `FIXED\(15\)`/);
    assert.match(plus!, /\*\*Expression type:\*\* `FIXED\(15\)`/);
});

test('Failed typing still documents operator without inventing a result type', () => {
    const { source, ast, semantic } = build(`F: PROC(A FIXED) RETURNS(FIXED);
        RETURN(A + 'text'); END;`);
    const invalid = hoverAt(source, ast, semantic, '+', "A + 'text'", 2);
    assert.match(invalid!, /# Dyadic operator/);
    assert.doesNotMatch(invalid!, /\*\*Expression type:\*\*/);
    const literal = hoverAt(source, ast, semantic, 'text', "A + 'text'", 4);
    assert.match(literal!, /\*\*Expression type:\*\* `CHAR\(4\)`/);
});

test('Parser-only hover works without semantic context', () => {
    const { source, ast } = build(`F: PROC RETURNS(FIXED);
        RETURN(1 + 2); END;`);
    const plus = hoverAt(source, ast, undefined, '+', '1 + 2', 2);
    assert.match(plus!, /# Dyadic operator/);
    assert.doesNotMatch(plus!, /\*\*Expression type:\*\*/);
});

test('Unresolved identifier has no guessed type in hover', () => {
    const { source, ast, semantic } = build(`F: PROC RETURNS(FIXED);
        RETURN(Unknown + 2); END;`);
    const identifier = hoverAt(source, ast, semantic, 'Unknown', 'Unknown + 2', 0);
    assert.match(identifier!, /# Identifier/);
    assert.doesNotMatch(identifier!, /\*\*Expression type:\*\*/);
    const operator = hoverAt(source, ast, semantic, '+', 'Unknown + 2', 8);
    assert.match(operator!, /# Dyadic operator/);
    assert.doesNotMatch(operator!, /\*\*Expression type:\*\*/);
});

test('Hover distinguishes local, module and global data objects from parameters', () => {
    const { source, ast, semantic } = build(`
        DCL ModVar FIXED;
        DCL Exported FIXED GLOBAL;
        RetTest: PROC(A FIXED) RETURNS(FIXED);
            DCL F8 (10) FIXED;
            RETURN(A + F8(1) + ModVar + Exported);
        END;`);
    assert.deepEqual(semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error), []);
    const expression = 'A + F8(1) + ModVar + Exported';
    assert.match(hoverAt(source, ast, semantic, 'A', expression, 0)!, /\*\*Symbol:\*\* parameter/);
    assert.match(hoverAt(source, ast, semantic, 'F8', expression, expression.indexOf('F8'))!,
        /\*\*Symbol:\*\* local variable/);
    assert.match(hoverAt(source, ast, semantic, 'ModVar', expression, expression.indexOf('ModVar'))!,
        /\*\*Symbol:\*\* module variable/);
    assert.match(hoverAt(source, ast, semantic, 'Exported', expression, expression.indexOf('Exported'))!,
        /\*\*Symbol:\*\* global variable/);
});
