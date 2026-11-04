// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { BinaryTransferStatementNode } from '../../ast/problem/statements/binaryTransferStatementNode';
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
    const uri = 'file:///binary-transfer-sem.p';
    const text = `P=MPC603; SC=2000; MODULE M; SYSTEM; Disk:/ED/testfile;
         PROBLEM; SPC Disk DATION INOUT ALPHIC;
         DCL ErrorStatus FIXED(31), ShortStatus FIXED, BadStatus FLOAT,
             Value FIXED, FloatValue FLOAT, Protected INV FIXED INIT(1),
             Name CHAR(20), Values(3) FIXED, Matrix(2,3) FIXED;
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
    const nodes: BinaryTransferStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof BinaryTransferStatementNode) nodes.push(node);
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

test('READ/WRITE transfer full arrays on ALPHIC DATION in RTOS-UH', () => {
    const r = analyze('READ Values, Value FROM Disk; WRITE Values, FloatValue, Value+1 TO Disk;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.nodes.length, 2);
});

test('READ target must be writable; WRITE accepts arbitrary expressions', () => {
    const r = analyze('READ Protected, Value FROM Disk; WRITE Protected, Value+1 TO Disk;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidBinaryReadTarget]);
});

test('wrong DATION target and wrong direction are diagnosed', () => {
    const r = analyze('READ Value FROM Value; WRITE Value TO InOnly; READ Value FROM OutOnly;',
        'DCL InOnly DATION IN ALPHIC CREATED(Disk); DCL OutOnly DATION OUT ALPHIC CREATED(Disk);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidBinaryTransferDation,
        SemanticDiagnosticCode.InvalidBinaryTransferDirection,
        SemanticDiagnosticCode.InvalidBinaryTransferDirection
    ]);
});

test('S requires writable FIXED(31); fewer and extra S formats are both allowed', () => {
    const r = analyze(`
        READ Value, FloatValue FROM Disk BY S(ErrorStatus);
        WRITE Value TO Disk BY S(ErrorStatus), S(ErrorStatus);
        WRITE Value TO Disk BY S(ShortStatus);
        WRITE Value TO Disk BY S(BadStatus);
        WRITE Value TO Disk BY S(Protected);
    `);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidBinaryTransferSFormat,
        SemanticDiagnosticCode.InvalidBinaryTransferSFormat,
        SemanticDiagnosticCode.InvalidBinaryTransferSFormat
    ]);
});

test('unknown names get only existing name-resolution diagnostics', () => {
    const r = analyze('READ Missing FROM MissingDation BY S(MissingStatus);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.UnknownIdentifier,
        SemanticDiagnosticCode.UnknownIdentifier,
        SemanticDiagnosticCode.UnknownIdentifier
    ]);
});

test('READ/WRITE bind object, DATION and S status names in Find References', () => {
    const r = analyze('READ Value FROM Disk BY S(ErrorStatus); WRITE Value TO Disk BY S(ErrorStatus);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const diskRead = (r.nodes[0].dation as any).segments[0].identifier;
    const diskWrite = (r.nodes[1].dation as any).segments[0].identifier;
    const status = r.nodes[0].formats[0].variable!.segments[0].identifier;
    assert.equal(r.semantic.bindings.get(diskRead)?.name.value, 'Disk');
    assert.equal(r.semantic.bindings.get(status)?.name.value, 'ErrorStatus');
    const group = r.occurrences.lookup(diskRead)!;
    assert.equal(group.references.length, 2);
    assert.ok(group.references.includes(diskWrite));
    const sGroup = r.occurrences.lookup(status)!;
    assert.equal(sGroup.references.length, 2);
    const keywordLoc = r.nodes[0].keyword.location!;
    const keyword = r.analysis.ast.lookupSourceValue({ uri: r.uri, offset: keywordLoc.span.start });
    assert.match(AstLookupResultDocumentationProvider.getDocumentation(keyword!, r.semantic)!, /^# READ/);
    const loc = diskRead.location!;
    const lookup = r.analysis.ast.lookupSourceValue({ uri: r.uri, offset: loc.span.start })!;
    assert.match(AstLookupResultDocumentationProvider.getDocumentation(lookup, r.semantic)!, /DATION/);
    assert.equal(lookupSymbolDefinition(r.semantic.bindings, lookup.element)?.value, 'Disk');

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
    const locations = findReferences(r.analysis, r.uri, positionAt(loc.span.start), false, registry);
    assert.equal(locations.length, 2);
});

test('I/O segments bind arrays and reject scalar destinations', () => {
    const r = analyze(`READ Values(1:3) FROM Disk;
        WRITE Values(2:3) TO Disk;
        READ Protected(1:2) FROM Disk;
        WRITE Value(1:2) TO Disk;`);
    assert.deepEqual(r.syntax, []);
    assert.ok(r.codes.includes(SemanticDiagnosticCode.InvalidIoSegment));
});


test('segment dimension and FIXED index types are checked separately', () => {
    const r = analyze(`
        READ Matrix(1, 2:3) FROM Disk;
        WRITE Matrix(1:2) TO Disk;
        READ Matrix(FloatValue, 1:2) FROM Disk;
    `);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidIoSegment,
        SemanticDiagnosticCode.InvalidIoSegment
    ]);
});

test('constant segment bounds are diagnosed; dynamic bounds remain unresolved', () => {
    const r = analyze(`
        READ Values(1:4) FROM Disk;
        WRITE Values(3:2) TO Disk;
        READ Values(1:Value) FROM Disk;
    `);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidIoSegment,
        SemanticDiagnosticCode.InvalidIoSegment
    ]);
});


test('segment names are ordinary symbol references for navigation', () => {
    const r = analyze('READ Values(1:3) FROM Disk; WRITE Values(1:2) TO Disk;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const first = r.nodes[0].objects[0] as import('../../ast/problem/statements/ioSegmentNode').IoSegmentNode;
    const second = r.nodes[1].objects[0] as import('../../ast/problem/statements/ioSegmentNode').IoSegmentNode;
    const name = first.array.segments[0].identifier;
    const group = r.occurrences.lookup(name)!;
    assert.equal(group.references.length, 2);
    assert.ok(group.references.includes(second.array.segments[0].identifier));
    assert.equal(r.semantic.bindings.get(name)?.name.value, 'Values');
});
