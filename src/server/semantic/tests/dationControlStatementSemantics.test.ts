// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { DationControlStatementNode } from '../../ast/problem/statements/dationControlStatementNode';
import { NameExpressionNode } from '../../ast/problem/expressions/nameExpressionNode';
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
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../symbolOccurrenceIndex';
import { Analysis } from '../../validation/analysis';
import { findReferences } from '../../lsp/findReferences';
import { AstLookupResultDocumentationProvider } from '../../documentation/astLookupResultDocumentationProvider';
import { lookupSymbolDefinition } from '../bindingIndex';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string, declarations = '') {
    const uri = 'file:///dation-control-sem.p';
    const text = `P=MPC603; SC=2000; MODULE M; SYSTEM; Disk:/ED/testfile;
         PROBLEM; SPC Disk DATION INOUT ALPHIC;
         DCL ErrorStatus FIXED, BadStatus FLOAT, FileName CHAR(24), Value FIXED,
             Protected INV FIXED INIT(1);
         ${declarations}
         Main: TASK MAIN; ${body} END; MODEND;`;
    const source = new FileSource(uri, text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const nodes: DationControlStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof DationControlStatementNode) nodes.push(node);
        node.getChildren().forEach(visit);
    };
    visit(ast);
    const refs = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(refs, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    const analysis = new Analysis(source, tokens, ast, problems, [],
        new PreprocessorConditionalBlockCollection(), semantic, refs, resolutions, occurrences);
    return { nodes, semantic, occurrences, analysis, uri, text,
        syntax: problems.toArray().map(p => p.message),
        codes: semantic.diagnostics.map(d => d.code) };
}

test('OPEN/CLOSE including IDF bind their names and appear in Find References', () => {
    const r = analyze('OPEN Disk BY IDF(FileName), NEW, EXCLUSIVE; CLOSE Disk BY PRM;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.nodes.length, 2);
    const diskOpen = r.nodes[0].dation!.segments[0].identifier;
    const diskClose = r.nodes[1].dation!.segments[0].identifier;
    assert.equal(r.semantic.bindings.get(diskOpen)?.name.value, 'Disk');
    const group = r.occurrences.lookup(diskOpen)!;
    assert.ok(group.references.includes(diskOpen));
    assert.ok(group.references.includes(diskClose));
    assert.equal(group.references.length, 2);
    const idfName = r.nodes[0].options[0].argument!;
    assert.ok(idfName instanceof NameExpressionNode);
    assert.ok(r.occurrences.all.some(g => g.declaration.value === 'FileName'
        && g.references.includes(idfName.segments[0].identifier)));
});

test('wrong DATION and IDF types are diagnosed independently', () => {
    const r = analyze('OPEN Value BY IDF(Value); CLOSE Disk BY PRM;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidDationControlTarget,
        SemanticDiagnosticCode.InvalidDationControlIdf
    ]);
});

test('invalid option combinations are semantically diagnosed, not rejected by parser', () => {
    const r = analyze('OPEN Disk BY NEW, OLD, EXCLUSIVE, IDF(FileName), IDF(FileName); CLOSE Disk BY CAN, PRM;');
    assert.deepEqual(r.syntax, []);
    assert.ok(r.codes.includes(SemanticDiagnosticCode.ConflictingDationControlOptions));
    assert.ok(r.codes.includes(SemanticDiagnosticCode.DuplicateDationControlOption));
});

test('wrong OPEN/CLOSE option and missing IDF cause their own diagnostics', () => {
    const r = analyze('OPEN Disk BY CAN, ANY; CLOSE Disk BY IDF(FileName);');
    assert.deepEqual(r.syntax, []);
    assert.equal(r.codes.filter(x => x === SemanticDiagnosticCode.InvalidDationControlOption).length, 3);
});

test('unknown symbols produce only shared UnknownIdentifier diagnostics', () => {
    const r = analyze('OPEN Unknown BY IDF(MissingName);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.UnknownIdentifier,
        SemanticDiagnosticCode.UnknownIdentifier
    ]);
});


test('real AST hover, go-to-definition binding and LSP findReferences work together', () => {
    const r = analyze('OPEN Disk BY IDF(FileName); CLOSE Disk BY CAN;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const statement = r.nodes[0];
    const open = statement.keyword.location!;
    const openHit = r.analysis.ast.lookupSourceValue({ uri: r.uri, offset: open.span.start });
    assert.match(AstLookupResultDocumentationProvider.getDocumentation(openHit!, r.semantic)!, /^# OPEN/);
    const option = statement.options[0].keyword.location!;
    const optionHit = r.analysis.ast.lookupSourceValue({ uri: r.uri, offset: option.span.start });
    assert.match(AstLookupResultDocumentationProvider.getDocumentation(optionHit!, r.semantic)!, /^# IDF/);

    const identifier = statement.dation!.segments[0].identifier;
    const loc = identifier.location!;
    const lookup = r.analysis.ast.lookupSourceValue({ uri: r.uri, offset: loc.span.start })!;
    assert.match(AstLookupResultDocumentationProvider.getDocumentation(lookup, r.semantic)!, /DATION/);
    const definition = lookupSymbolDefinition(r.semantic.bindings, lookup.element);
    assert.ok(definition?.location);
    assert.equal(definition.value, 'Disk');
    // SYSTEM declaration is the definition behind SPC Disk.
    assert.ok(definition.location.span.start < loc.span.start);

    const positionAt = (offset: number) => {
        const prior = r.text.slice(0, offset);
        return { line: prior.split('\n').length - 1,
            character: prior.length - prior.lastIndexOf('\n') - 1 };
    };
    const registry = {
        get: (uri: string) => uri === r.uri ? {
            positionAt,
            getText: () => r.text,
            offsetAt: (position: { line: number; character: number }) => {
                const lines = r.text.split('\n');
                return lines.slice(0, position.line).reduce((n, l) => n + l.length + 1, 0)
                    + position.character;
            }
        } : null
    } as unknown as DocumentRegistry;
    const references = findReferences(r.analysis, r.uri, positionAt(loc.span.start), false, registry);
    assert.equal(references.length, 2);
    assert.deepEqual(references.map(x => x.range.start), [
        positionAt(r.nodes[0].dation!.segments[0].identifier.location!.span.start),
        positionAt(r.nodes[1].dation!.segments[0].identifier.location!.span.start)
    ]);
});


test('EXCLUSIVE requires one of NEW, OLD or ANY in RTOS-UH', () => {
    const r = analyze('OPEN Disk BY IDF(FileName), EXCLUSIVE;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidDationControlOption]);
});

test('RTOS-UH: OPEN rejects CAN and PRM; CLOSE rejects all OPEN-only options', () => {
    const r = analyze(`
        OPEN Disk BY CAN;
        OPEN Disk BY PRM;
        CLOSE Disk BY IDF(FileName);
        CLOSE Disk BY NEW;
        CLOSE Disk BY OLD;
        CLOSE Disk BY ANY;
        CLOSE Disk BY EXCLUSIVE;
    `);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.nodes.length, 7);
    assert.deepEqual(r.codes, Array(7).fill(SemanticDiagnosticCode.InvalidDationControlOption));
});

test('RTOS-UH: valid OPEN file modes and CLOSE CAN/PRM produce no diagnostics', () => {
    const r = analyze(`
        OPEN Disk BY IDF(FileName), NEW;
        OPEN Disk BY IDF(FileName), OLD;
        OPEN Disk BY IDF(FileName), ANY;
        OPEN Disk BY IDF(FileName), ANY, EXCLUSIVE;
        CLOSE Disk BY CAN;
        CLOSE Disk BY PRM;
    `);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.nodes.length, 6);
});


test('RTOS-UH OPEN/CLOSE RST is a syntax error, without spurious symbol diagnostics', () => {
    const r = analyze('OPEN Disk BY RST(ErrorStatus); CLOSE Disk BY RST(ErrorStatus); OPEN Disk; CLOSE Disk;');
    assert.equal(r.syntax.filter(m => m.includes('does not support RST')).length, 2);
    assert.deepEqual(r.codes, []);
    assert.equal(r.nodes.length, 4);
    assert.deepEqual(r.nodes.map(node => node.options.length), [0, 0, 0, 0]);
});
