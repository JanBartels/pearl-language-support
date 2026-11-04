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
import { SymbolReferenceCollector } from '../../semantic/symbolReferenceCollector';
import { SymbolReferenceResolver } from '../../semantic/symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../../semantic/symbolOccurrenceIndex';
import { lookupSymbolDefinition } from '../../semantic/bindingIndex';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { findReferences } from '../../lsp/findReferences';
import { AstLookupResultDocumentationProvider } from '../astLookupResultDocumentationProvider';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const uri = 'file:///tasking-navigation.P';
const log: Logger = { info() {}, warn() {}, error() {} };
const program = `P=MPC603; SC=2000; MODULE M;
SYSTEM; Alarm: EV(00000001);
PROBLEM;
SPC Alarm INTERRUPT;
DCL Tick DURATION, Clk CLOCK, Priority INV FIXED INIT(25), Handle REF TASK;
Worker: TASK; END;
Main: TASK MAIN;
    AT Clk ALL Tick UNTIL Clk ACTIVATE Worker PRIO Priority;
    AFTER 0 SEC ALL Tick DURING Tick ACTIVATE Handle;
    WHEN Alarm CONTINUE Worker;
    WHEN Alarm RESUME;
    TERMINATE Worker;
    SUSPEND Handle;
    PREVENT Worker;
END;
MODEND;`;

function analyze(text = program, sourceUri = uri) {
    const source = new FileSource(sourceUri, text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, log).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), log);
    const ast = new Parser(stream, problems, log).parse();
    const references = new SymbolReferenceCollector().collect(ast);
    const semantic = new SemanticAnalyzer().analyze(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    const analysis = new Analysis(source, tokens, ast, problems, [],
        new PreprocessorConditionalBlockCollection(), semantic, references, resolutions, occurrences);
    assert.deepEqual(problems.toArray().map(p => p.message), []);
    assert.deepEqual(semantic.diagnostics.map(d => d.message), []);
    return { source, ast, semantic, analysis, occurrences };
}

function pos(text: string, offset: number) {
    const prefix = text.slice(0, offset);
    const line = prefix.split('\n').length - 1;
    return { line, character: offset - prefix.lastIndexOf('\n') - 1 };
}
function offset(text: string, fragment: string, from = 0) {
    const result = text.indexOf(fragment, from);
    assert.ok(result >= 0, `Missing ${fragment}`);
    return result;
}
function registry(text = program): DocumentRegistry {
    return { get: (name: string) => name === uri ? {
        positionAt: (index: number) => pos(text, index),
        offsetAt: (position: { line: number; character: number }) => {
            const lines = text.split('\n');
            return lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0)
                + position.character;
        },
        getText: () => text
    } : null } as unknown as DocumentRegistry;
}
function lookupAt(analysis: ReturnType<typeof analyze>, fragment: string, skip = 0, shift = 0) {
    const at = offset(analysis.source.text, fragment, skip) + shift;
    const result = analysis.ast.lookupSourceValue({ uri: analysis.source.uri, offset: at });
    assert.ok(result, `No AST lookup for ${fragment}`);
    return result;
}
function hoverAt(analysis: ReturnType<typeof analyze>, fragment: string, skip = 0, shift = 0) {
    const result = lookupAt(analysis, fragment, skip, shift);
    return AstLookupResultDocumentationProvider.getDocumentation(result, analysis.semantic);
}
function refsAt(analysis: ReturnType<typeof analyze>, fragment: string, skip = 0, includeDeclaration = false) {
    const at = offset(analysis.source.text, fragment, skip) + fragment.indexOf(' ') + 1;
    return findReferences(analysis.analysis, uri, pos(program, at), includeDeclaration, registry());
}

test('8.5.3: all task-control keyword hovers use the existing AST documentation path', () => {
    const a = analyze();
    for (const name of ['ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE', 'RESUME', 'PREVENT']) {
        assert.match(hoverAt(a, name === 'RESUME' ? 'RESUME;' : `${name} `)!, new RegExp(`^# ${name}`));
    }
    assert.match(hoverAt(a, 'PRIO Priority')!, /^# PRIO/);
});

test('8.5.3: AT, AFTER, ALL, UNTIL, DURING and WHEN have independent hovers', () => {
    const a = analyze();
    for (const name of ['AT', 'AFTER', 'ALL', 'UNTIL', 'DURING', 'WHEN']) {
        assert.match(hoverAt(a, name === 'RESUME' ? 'RESUME;' : `${name} `)!, new RegExp(`^# ${name}`));
    }
    assert.match(hoverAt(a, 'AFTER 0 SEC')!, /0 SEC/);
    assert.match(hoverAt(a, 'DURING Tick')!, /nichtnegative/);
});

test('8.5.3: TASK, REF TASK and INTERRUPT operands retain symbol and type hovers', () => {
    const a = analyze();
    assert.match(hoverAt(a, 'ACTIVATE Worker', 0, 'ACTIVATE '.length)!, /\*\*Symbol:\*\* task/);
    assert.match(hoverAt(a, 'ACTIVATE Handle', 0, 'ACTIVATE '.length)!, /\*\*Type:\*\* `REF TASK`/);
    assert.match(hoverAt(a, 'WHEN Alarm', 0, 'WHEN '.length)!, /\*\*Type:\*\* `INTERRUPT`/);
    assert.match(hoverAt(a, 'PRIO Priority', 0, 'PRIO '.length)!, /\*\*Type:\*\* `FIXED`/);
});

test('8.5.3: Go to Definition resolves TASK and INTERRUPT uses to their own declarations', () => {
    const a = analyze();
    for (const [fragment, shift, expected] of [
        ['ACTIVATE Worker', 'ACTIVATE '.length, 'Worker: TASK'],
        ['ACTIVATE Handle', 'ACTIVATE '.length, 'Handle REF TASK'],
        ['WHEN Alarm', 'WHEN '.length, 'Alarm INTERRUPT']
    ] as const) {
        const lookup = lookupAt(a, fragment, 0, shift);
        const target = lookupSymbolDefinition(a.semantic.bindings, lookup.element);
        assert.ok(target?.location, `Missing definition for ${fragment}`);
        assert.equal(target.value, expected.split(' ')[0].replace(':', ''));
        assert.equal(target.location.source.uri, uri);
    }
});

test('8.5.3: Find References groups TASK uses, REF TASK variables and WHEN interrupts separately', () => {
    const a = analyze();
    const worker = refsAt(a, 'ACTIVATE Worker');
    const handle = refsAt(a, 'ACTIVATE Handle');
    const alarm = refsAt(a, 'WHEN Alarm');
    assert.equal(worker.length, 4);
    assert.equal(handle.length, 2);
    assert.equal(alarm.length, 2);
    assert.equal(refsAt(a, 'ACTIVATE Worker', 0, true).length, 5);
    assert.equal(refsAt(a, 'ACTIVATE Handle', 0, true).length, 3);
    assert.deepEqual(refsAt(a, 'WHEN Alarm', 0), refsAt(a, 'WHEN Alarm', offset(program, 'WHEN Alarm') + 1));
    assert.notDeepEqual(worker, handle);
});

test('8.5.3: time and priority expression references remain navigable', () => {
    const a = analyze();
    assert.equal(refsAt(a, 'ALL Tick').length, 3);
    assert.equal(refsAt(a, 'AT Clk').length, 2);
    assert.equal(refsAt(a, 'PRIO Priority').length, 1);
});

test('8.5.3: keywords and absent optional task names do not create symbol references', () => {
    const a = analyze();
    assert.equal(refsAt(a, 'ACTIVATE Worker', 0).length, 4);
    assert.equal(findReferences(a.analysis, uri, pos(program, offset(program, 'ACTIVATE Worker')),
        false, registry()).length, 0);
    assert.equal(findReferences(a.analysis, 'file:///other.P', pos(program, offset(program, 'ACTIVATE Worker') + 9),
        true, registry()).length, 0);
});
