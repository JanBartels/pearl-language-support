// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { BasicTransferStatementNode } from '../../ast/problem/statements/basicTransferStatementNode';
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
import { lookupSymbolDefinition } from '../bindingIndex';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const uri = 'file:///take-send-semantic.P';
    const source = new FileSource(uri, `P=MPC603; SC=2000; MODULE TKS;
        SYSTEM;
            Eingang: BU(0240FFFC) <-;
            Ausgang: BU(0240FFF8) ->;
            Beide: BU(0240FFF4) <->;
            Textstation: /NIL <->;
        PROBLEM;
            SPC Eingang DATION IN BASIC;
            SPC Ausgang DATION OUT BASIC;
            SPC Beide DATION INOUT BASIC;
            SPC Textstation DATION INOUT ALPHIC;
            DCL Wort BIT(16), Kurz FIXED(15), Lang FIXED(31),
                Gleit FLOAT, Zeichen CHAR(4), Feld(3) FIXED(15),
                Konst INV FIXED(15) INIT(12);
            Probe: TASK; ${body} END;
        MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const nodes: BasicTransferStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof BasicTransferStatementNode) nodes.push(node);
        node.getChildren().forEach(visit);
    };
    visit(ast);
    const refs = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(refs, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    return { nodes, semantic, occurrences,
        syntax: problems.toArray().map(p => p.message),
        codes: semantic.diagnostics.map(d => d.code) };
}

test('RTOS-UH 6.2: TAKE/SEND accept BASIC, both directions, all demonstrated simple types', () => {
    const r = analyze(`TAKE Wort FROM Eingang; SEND '008F'B4 TO Ausgang;
        TAKE Wort FROM Beide; SEND Wort TO Beide;
        TAKE Kurz,Lang,Gleit,Zeichen FROM Eingang;
        SEND Kurz,Lang,Gleit,Zeichen,Kurz+1 TO Ausgang;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.nodes.length, 6);
});

test('Empty data lists compile under original RTOS-UH', () => {
    const r = analyze('TAKE FROM Eingang; SEND TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('BASIC DATION class is required, also for INOUT', () => {
    const r = analyze('TAKE Wort FROM Textstation; SEND Wort TO Textstation;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidBasicTransferDation,
        SemanticDiagnosticCode.InvalidBasicTransferDation
    ]);
});

test('Direction is checked separately from DATION class', () => {
    const r = analyze('TAKE Wort FROM Ausgang; SEND Wort TO Eingang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidBasicTransferDirection,
        SemanticDiagnosticCode.InvalidBasicTransferDirection
    ]);
});

test('TAKE rejects invariant objects; SEND accepts them', () => {
    const r = analyze('TAKE Konst FROM Eingang; SEND Konst TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidBasicTakeTarget]);
});

test('Fields are not among the simple data types supported by /BU', () => {
    const r = analyze('TAKE Feld FROM Eingang; SEND Feld TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidBasicTransferData,
        SemanticDiagnosticCode.InvalidBasicTransferData
    ]);
});

test('Single array element can be transferred with TAKE/SEND', () => {
    const r = analyze('TAKE Feld(1) FROM Eingang; SEND Feld(2) TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('Unknown names use the common symbol-resolution diagnostics, without duplicates', () => {
    const r = analyze('TAKE Missing FROM MissingDation;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.UnknownIdentifier,
        SemanticDiagnosticCode.UnknownIdentifier
    ]);
});

test('TAKE/SEND preserve symbol binding, definition and grouped references', () => {
    const r = analyze('TAKE Wort FROM Beide; SEND Wort TO Beide;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const object = (r.nodes[0].objects[0] as any).segments[0].identifier;
    const dationRead = r.nodes[0].dation!.segments[0].identifier;
    const dationSend = r.nodes[1].dation!.segments[0].identifier;
    assert.equal(r.semantic.bindings.get(object)?.name.value, 'Wort');
    assert.equal(r.semantic.bindings.get(dationRead)?.name.value, 'Beide');
    assert.equal(r.semantic.bindings.get(dationSend)?.name.value, 'Beide');
    const definition = lookupSymbolDefinition(r.semantic.bindings, dationRead);
    assert.ok(definition);
    const occurrence = r.occurrences.lookup(dationRead)!;
    assert.equal(occurrence.references.length, 2);
});
