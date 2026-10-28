// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { CaseStatementNode } from '../../ast/problem/statements/caseStatementNode';
import { CaseIndexRangeNode } from '../../ast/problem/statements/caseIndexRangeNode';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const source = new FileSource('file:///case-expression.pearl',
        `MODULE M; PROBLEM; R: PROC(I FIXED); ${body} END; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root);
    const statements: CaseStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof CaseStatementNode) statements.push(node);
        for (const child of node.getChildren()) visit(child);
    };
    visit(root);
    return { root, source, statements, semantic,
        syntax: problems.toArray().map(p => p.message),
        codes: semantic.diagnostics.map(d => d.code).filter(code =>
            code !== SemanticDiagnosticCode.MissingProcessorSetting
            && code !== SemanticDiagnosticCode.MissingScModuleSize) };
}

test('positional CASE takes general FIXED expression and binds names', () => {
    const r = analyze('CASE I+1 ALT RETURN; ALT RETURN; FIN;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.ok(r.statements[0].selector);
    assert.equal(r.semantic.expressionTypes.get(r.statements[0].selector!)?.kind,
        SemanticTypeKind.Fixed);
    const where = r.source.text.indexOf('I+1');
    const lookup = r.root.lookupSourceValue({uri:r.source.uri,offset:where});
    assert.equal(r.semantic.bindings.get(lookup!.element as any)?.kind, SymbolKind.Parameter);
});

test('positional CASE rejects FLOAT, BIT and CHAR selectors', () => {
    const r = analyze(`CASE I*1.0 ALT RETURN; FIN;
       CASE 'X' ALT RETURN; FIN; CASE '1'B ALT RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(3).fill(SemanticDiagnosticCode.InvalidCaseSelector));
});

test('indexed FIXED CASE accepts negative, named INV bounds and arithmetic constants', () => {
    const r = analyze(`DCL Limit INV FIXED INIT(5);
       CASE I ALT (-2:Limit, 7+1) RETURN; OUT RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.statements[0].alternatives[0].ranges.length, 2);
    assert.ok(r.statements[0].alternatives[0].ranges[0] instanceof CaseIndexRangeNode);
});

test('indexed CASE allows CHAR(1) and single-character literal ranges', () => {
    const r = analyze(`DCL C CHAR(1);
       CASE C ALT ('A':'Z', '0') RETURN; OUT RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.statements[0].alternatives[0].ranges.length, 2);
});

test('indexed CASE rejects incompatible selector types', () => {
    const r = analyze(`DCL C CHAR(3);
       CASE C ALT ('A') RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidCaseSelector]);
});

test('ALT bounds must match selector type; do not duplicate errors', () => {
    const r = analyze(`CASE I ALT ('A') RETURN; ALT (1.5) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidCaseAlternativeType,
        SemanticDiagnosticCode.InvalidCaseAlternativeType]);
});

test('ALT cannot use a runtime variable even when FIXED', () => {
    const r = analyze(`CASE I ALT (I) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.NonConstantCaseAlternative]);
});

test('ALT reversed range is rejected', () => {
    const r = analyze(`CASE I ALT (9:2) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidCaseRange]);
});

test('nested expression diagnoses and CASE branch RETURN work together', () => {
    const r = analyze(`DCL A(10) FIXED;
       CASE A(11) ALT (1) CASE I ALT RETURN; FIN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
    assert.equal(r.statements.length, 2);
});

test('invalid assignment operator in CASE selector is diagnosed at token', () => {
    const r = analyze(`CASE I = 1 ALT RETURN; FIN;`);
    assert.equal(r.syntax.length, 1);
    assert.match(r.syntax[0], /Operator '='.*nicht zulässig/);
    assert.equal(r.statements[0].selector, undefined);
});

test('AST source lookup enters ALT range expression and resolves its constant name', () => {
    const r = analyze(`DCL N INV FIXED INIT(2); CASE I ALT (N:5) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    const where = r.source.text.indexOf('(N:5)') + 1;
    const lookup = r.root.lookupSourceValue({uri:r.source.uri,offset:where});
    assert.equal(lookup?.element.value, 'N');
    assert.equal(r.semantic.bindings.get(lookup!.element as any)?.kind, SymbolKind.DataObject);
});

test('indexed CASE recognizes named INV CHAR(1) constants', () => {
    const r = analyze(`DCL Letter INV CHAR(1) INIT('G'), Key CHAR(1);
       CASE Key ALT ('A':Letter) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('CASE selector handles array references and function results', () => {
    const r = analyze(`DCL A(10) FIXED;
       CASE A(11) ALT (1) RETURN; FIN;
       CASE A(I) ALT (2) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
});

test('ALT selector assignment operator generates parser diagnostic', () => {
    const r = analyze(`CASE I ALT (I=1) RETURN; FIN;`);
    assert.equal(r.syntax.length, 1);
    assert.match(r.syntax[0], /Operator '='.*nicht zulässig/);
});

test('CASE supports FIXED(31) selector and alternative without imposing FIXED(15)', () => {
    const r = analyze(`DCL Wide FIXED(31); CASE Wide ALT (65536(31)) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('indexed CASE reports repeated values and values covered by earlier ranges', () => {
    const r = analyze(`DCL RA(10) FIXED;
        CASE RA(I)+1
          ALT (1:5) RETURN;
          ALT (7, 9) RETURN;
          ALT ('Huhu') RETURN;
          ALT (8) RETURN;
          ALT (9) RETURN;
          ALT (I) RETURN;
          ALT (4) RETURN;
          OUT RETURN;
        FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidCaseAlternativeType,
        SemanticDiagnosticCode.OverlappingCaseAlternative,
        SemanticDiagnosticCode.NonConstantCaseAlternative,
        SemanticDiagnosticCode.OverlappingCaseAlternative
    ]);
    const overlaps = r.semantic.diagnostics.filter(d =>
        d.code === SemanticDiagnosticCode.OverlappingCaseAlternative);
    assert.match(overlaps[0].message, /9/);
    assert.match(overlaps[1].message, /4/);
    assert.equal(overlaps[0].location.span.start, r.source.text.indexOf('ALT (9)') + 5);
    assert.equal(overlaps[1].location.span.start, r.source.text.indexOf('ALT (4)') + 5);
    assert.equal(overlaps[0].relatedLocations?.[0].location.span.start,
        r.source.text.indexOf('ALT (7, 9)') + 8);
    assert.equal(overlaps[1].relatedLocations?.[0].location.span.start,
        r.source.text.indexOf('ALT (1:5)') + 5);
});

test('overlaps are detected inside one ALT and for overlapping FIXED ranges', () => {
    const r = analyze(`CASE I
      ALT (1:5, 4, 8:12, 12) RETURN;
      ALT (3:9) RETURN;
      ALT (15:20) RETURN;
      ALT (21) RETURN;
    FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(3).fill(SemanticDiagnosticCode.OverlappingCaseAlternative));
});

test('named FIXED constants and arithmetic expressions compare by evaluated values', () => {
    const r = analyze(`DCL N INV FIXED INIT(4);
      CASE I ALT (1:5) RETURN; ALT (N+0) RETURN; ALT (2*2) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.OverlappingCaseAlternative,
        SemanticDiagnosticCode.OverlappingCaseAlternative]);
});

test('CHAR(1) ranges and named constants report overlapping selection values', () => {
    const r = analyze(`DCL Letter CHAR(1), Key INV CHAR(1) INIT('D');
      CASE Letter
        ALT ('A':'G') RETURN;
        ALT (Key) RETURN;
        ALT ('F':'Z') RETURN;
        ALT ('0':'9') RETURN;
      FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.OverlappingCaseAlternative,
        SemanticDiagnosticCode.OverlappingCaseAlternative]);
});

test('invalid ALT bounds and reversed ranges are not inserted into overlap index', () => {
    const r = analyze(`CASE I
      ALT (9:2) RETURN;
      ALT (I) RETURN;
      ALT ('X') RETURN;
      ALT (1:5) RETURN;
      ALT (6:8) RETURN;
    FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidCaseRange,
        SemanticDiagnosticCode.NonConstantCaseAlternative,
        SemanticDiagnosticCode.InvalidCaseAlternativeType]);
});

test('independent and nested CASEs do not share the interval index', () => {
    const r = analyze(`CASE I ALT (1)
      CASE I ALT (1) RETURN; FIN;
      RETURN;
    FIN;
    CASE I ALT (1) RETURN; FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('large FIXED(31) intervals are checked without expanding their values', () => {
    const r = analyze(`DCL Wide FIXED(31);
      CASE Wide
        ALT (0(31):2147483647(31)) RETURN;
        ALT (65536(31)) RETURN;
      FIN;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.OverlappingCaseAlternative]);
});
