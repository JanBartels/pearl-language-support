// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
import { Analysis } from '../../validation/analysis';
import { findReferences } from '../../lsp/findReferences';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../symbolOccurrenceIndex';

const quietLogger: Logger = { info() {}, warn() {}, error() {} };
const uri = 'file:///main.pearl';

function makeAnalysis(text: string, sourceUri = uri): Analysis {
    const source = new FileSource(sourceUri, text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, quietLogger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), quietLogger);
    const ast = new Parser(stream, problems, quietLogger).parse();
    const refs = new SymbolReferenceCollector().collect(ast);
    const semantic = new SemanticAnalyzer().analyze(ast);
    const resolutions = new SymbolReferenceResolver().resolve(refs, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    return new Analysis(source, tokens, ast, problems, [],
        new PreprocessorConditionalBlockCollection(), semantic, refs, resolutions, occurrences);
}

function registryFor(...sources: { uri: string; text: string }[]): DocumentRegistry {
    return {
        get: (name: string) => {
            const source = sources.find(entry => entry.uri === name);
            if (!source) return null;
            return {
                positionAt: (offset: number) => {
                    const prior = source.text.slice(0, offset);
                    const line = prior.split('\n').length - 1;
                    return { line, character: prior.length - prior.lastIndexOf('\n') - 1 };
                }
            };
        }
    } as unknown as DocumentRegistry;
}

function lookup(analysis: Analysis, name: string) {
    return analysis.symbolOccurrences.all.find(group => group.declaration.value === name);
}

function refsAt(analysis: Analysis, text: string, at: number, includeDeclaration = false) {
    const registry = registryFor({ uri, text });
    const prior = text.slice(0, at);
    const position = { line: prior.split('\n').length - 1,
        character: prior.length - prior.lastIndexOf('\n') - 1 };
    return findReferences(analysis, uri, position, includeDeclaration, registry);
}

test('7.3: declaration cursor and reference cursor return same bound uses', () => {
    const text = `MODULE; PROBLEM;
        TYPE Node FIXED;
        DCL a REF Node;
        DCL b REF Node;
        MODEND;`;
    const analysis = makeAnalysis(text);
    const occurrences = lookup(analysis, 'Node')!;
    assert.equal(occurrences.declarations.length, 1);
    assert.equal(occurrences.references.length, 2);
    const declaration = text.indexOf('Node');
    const use = text.indexOf('Node', declaration + 1);
    assert.deepEqual(refsAt(analysis, text, declaration), refsAt(analysis, text, use));
    assert.equal(refsAt(analysis, text, declaration).length, 2);
    assert.equal(refsAt(analysis, text, use, true).length, 3);
});

test('7.3: shadowed type references stay in separate declaration groups', () => {
    const text = `MODULE; PROBLEM;
        TYPE Level FIXED;
        DCL outer REF Level;
        Main: PROC;
            TYPE Level FLOAT;
            DCL inner REF Level;
        END;
        MODEND;`;
    const analysis = makeAnalysis(text);
    const first = text.indexOf('Level');
    const second = text.indexOf('Level', first + 1);
    const third = text.indexOf('Level', second + 1);
    const fourth = text.indexOf('Level', third + 1);
    const outer = refsAt(analysis, text, first, true);
    const inner = refsAt(analysis, text, third, true);
    assert.equal(outer.length, 2);
    assert.equal(inner.length, 2);
    assert.notDeepEqual(outer, inner);
    assert.deepEqual(refsAt(analysis, text, second, true), outer);
    assert.deepEqual(refsAt(analysis, text, fourth, true), inner);
});

test('7.3: GLOBAL SPC has a local declaration but no fabricated external definition', () => {
    const text = `MODULE; PROBLEM;
        SPC Work PROC GLOBAL;
        Main: PROC;
            CALL Work;
        END;
        MODEND;`;
    const analysis = makeAnalysis(text);
    const start = text.indexOf('Work');
    assert.equal(refsAt(analysis, text, start).length, 1);
    assert.equal(refsAt(analysis, text, start, true).length, 2);
});

test('7.3: local SPC/PROC are one semantic target, with two declaration sites', () => {
    const text = `MODULE; PROBLEM;
        SPC Work PROC;
        Work: PROC; END;
        Main: PROC; CALL Work; END;
        MODEND;`;
    const analysis = makeAnalysis(text);
    const spec = text.indexOf('Work');
    const definition = text.indexOf('Work', spec + 1);
    const call = text.indexOf('Work', definition + 1);
    assert.equal(refsAt(analysis, text, call).length, 1);
    assert.equal(refsAt(analysis, text, call, true).length, 3);
    assert.deepEqual(refsAt(analysis, text, spec, true), refsAt(analysis, text, definition, true));
});

test('7.3: unknown names, keywords and builtin calls do not invent symbol references', () => {
    const text = `MODULE; PROBLEM;
        Main: PROC; CALL Unknown; CALL SEEK; END;
        MODEND;`;
    const analysis = makeAnalysis(text);
    assert.equal(refsAt(analysis, text, text.indexOf('Unknown')).length, 0);
    assert.equal(refsAt(analysis, text, text.indexOf('SEEK')).length, 0);
    assert.equal(refsAt(analysis, text, text.indexOf('MODULE')).length, 0);
});

test('7.3: named declaration with no uses supports includeDeclaration', () => {
    const text = 'MODULE; PROBLEM; TYPE Empty FIXED; MODEND;';
    const analysis = makeAnalysis(text);
    assert.equal(refsAt(analysis, text, text.indexOf('Empty')).length, 0);
    assert.equal(refsAt(analysis, text, text.indexOf('Empty'), true).length, 1);
});

test('7.3: distinct URI prevents cross-file offset collisions', () => {
    const text = 'MODULE; PROBLEM; TYPE Node FIXED; DCL a REF Node; MODEND;';
    const analysis = makeAnalysis(text);
    const registry = registryFor({ uri, text }, { uri: 'file:///other.pearl', text });
    const result = findReferences(analysis, 'file:///other.pearl', { line: 0, character: text.indexOf('Node') }, true, registry);
    assert.deepEqual(result, []);
});

test('7.3: GOTO targets are connected to labels, not similarly spelled variables', () => {
    const text = `MODULE; PROBLEM;
        Main: PROC;
            GOTO Next;
            Next: ;
            GOTO Next;
        END;
        MODEND;`;
    const analysis = makeAnalysis(text);
    assert.equal(refsAt(analysis, text, text.indexOf('Next'), false).length, 2);
    assert.equal(refsAt(analysis, text, text.indexOf('Next'), true).length, 3);
});

test('7.3: macro-expanded uses are displayed once at the invocation', () => {
    const text = '#define NAME "Node"\nMODULE; PROBLEM; TYPE Node FIXED; DCL a REF NAME; MODEND;';
    const analysis = makeAnalysis(text);
    const mapped = refsAt(analysis, text, text.lastIndexOf('NAME'), true);
    assert.equal(mapped.length, 2);
    assert.equal(mapped[1].range.start.character, text.lastIndexOf('NAME') - text.lastIndexOf('\n') - 1);
});

test('7.3: include definition and root-file use have their own physical URIs', () => {
    const includeUri = 'file:///defs.pearl';
    const includeText = 'TYPE Shared FIXED;\n';
    const rootText = 'MODULE; PROBLEM;\n#include "defs.pearl"\nDCL p REF Shared; MODEND;';
    const source = new FileSource(uri, rootText);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, quietLogger).tokenize();
    const registry = {
        resolveInclude: (_root: string, _path: string) => ({
            uri: includeUri,
            getText: () => includeText
        }),
        addInclude: () => {}
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), quietLogger);
    const ast = new Parser(stream, problems, quietLogger).parse();
    const refs = new SymbolReferenceCollector().collect(ast);
    const semantic = new SemanticAnalyzer().analyze(ast);
    const resolutions = new SymbolReferenceResolver().resolve(refs, semantic);
    const occurrenceIndex = new SymbolOccurrenceIndex(resolutions, semantic);
    const analysis = new Analysis(source, tokens, ast, problems, [],
        new PreprocessorConditionalBlockCollection(), semantic, refs, resolutions, occurrenceIndex);
    const mapRegistry = registryFor({ uri, text: rootText }, { uri: includeUri, text: includeText });
    const results = findReferences(analysis, includeUri,
        { line: 0, character: includeText.indexOf('Shared') }, true, mapRegistry);
    assert.equal(results.length, 2);
    assert.deepEqual(results.map(entry => entry.uri).sort(), [includeUri, uri].sort());
});

test('RTOS-UH: GLOBAL(module) is rejected, bare GLOBAL is accepted', () => {
    const valid = makeAnalysis('MODULE; PROBLEM; SPC Remote PROC GLOBAL; MODEND;');
    const invalid = makeAnalysis('MODULE; PROBLEM; SPC Remote PROC GLOBAL(Foreign); MODEND;');
    assert.equal(invalid.problems.size(), valid.problems.size() + 1);
    assert.ok([...invalid.problems].some(problem => problem.message.includes('only GLOBAL')));
    assert.equal(invalid.symbolOccurrences.all.some(group => group.declaration.value === 'Foreign'), false);
});

test('7.2 correction: GLOBAL SPC TASK does not bind a non-GLOBAL local TASK', () => {
    const text = 'MODULE; PROBLEM; SPC Worker TASK GLOBAL; Worker: TASK; END; MODEND;';
    const analysis = makeAnalysis(text);
    const nameLocations = analysis.symbolOccurrences.all.filter(group => group.declaration.value === 'Worker');
    assert.equal(nameLocations.length, 2);
    const spec = text.indexOf('Worker');
    const actual = text.indexOf('Worker', spec + 1);
    assert.notDeepEqual(refsAt(analysis, text, spec, true), refsAt(analysis, text, actual, true));
});
