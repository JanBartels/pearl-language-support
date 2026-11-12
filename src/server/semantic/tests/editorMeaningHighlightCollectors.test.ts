// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { ArrayTokenStream } from '../../lexer/arrayTokenStream';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroOccurrenceIndex } from '../../preproc/macroOccurrenceIndex';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import { TokenLegend } from '../../semanticTokens/tokenLegend';
import { SourceHighlightMapper } from '../../semanticTokens/sourceHighlightMapper';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { MacroHighlightCollector } from '../macroHighlightCollector';
import { OperatorHighlightCollector } from '../operatorHighlightCollector';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SourceHighlightAttribute as Attribute, SourceHighlightKind as Kind, type SourceHighlight } from '../sourceHighlight';
import { SymbolHighlightCollector } from '../symbolHighlightCollector';
import { SymbolOccurrenceIndex } from '../symbolOccurrenceIndex';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import { Validator } from '../../validation/validator';
import type { WorkspaceManager } from '../../utility/workspace';
import { defaultSettings } from '../../settings/pearlSettings';

const uri = 'file:///editor-highlight.P';
const logger: Logger = {info() {}, warn() {}, error() {}};

/** Real lex/preprocess/parse/resolve pipeline, independent of the LSP server. */
function analyze(text: string, predefined: Record<string, string> = {}, includes: Record<string, string> = {}) {
    const file = new FileSource(uri, text);
    const problems = new ProblemCollection();
    const table = new MacroTable();
    for (const [name, value] of Object.entries(predefined)) table.define(name, value);
    const registry = {
        resolveInclude: (_from: string, name: string) => {
            const includeUri = `file:///${name}`;
            const contents = includes[includeUri];
            return contents === undefined ? null : {uri: includeUri, getText: () => contents};
        },
        addInclude() {}
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, table,
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const original = new Lexer(file, problems, logger).tokenize();
    const expanded = Preprocessor.createExpanded(original, file, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const tokens = new Lexer(expanded.source, problems, logger).tokenize();
    const ast = new Parser(
        new ArrayTokenStream(tokens, expanded.source), problems, logger
    ).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const references = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    const macros = new MacroOccurrenceIndex(context.macroDefinitions, expanded.macroReferences);
    const highlights = [
        ...new SymbolHighlightCollector().collect(semantic, occurrences),
        ...new MacroHighlightCollector().collect(macros),
        ...new OperatorHighlightCollector().collect(ast, semantic)
    ];
    return {file, highlights, macros, semantic, problems};
}

function locations(highlights: readonly SourceHighlight[], value: string, kind: Kind) {
    return highlights.filter(h => h.kind === kind && h.element.value === value);
}

function fakeDocument(text: string): TextDocument {
    return {
        uri,
        getText: () => text,
        positionAt: (offset: number) => {
            const preceding = text.slice(0, offset);
            const lines = preceding.split(/\r\n|\r|\n/);
            return {line: lines.length - 1, character: lines[lines.length - 1]!.length};
        }
    } as TextDocument;
}

function mapped(text: string, highlights: readonly SourceHighlight[]) {
    const legend = new TokenLegend();
    const data = new SourceHighlightMapper(legend).map(fakeDocument(text), highlights).data;
    const positions: {text: string; kind: number; modifiers: number}[] = [];
    let line = 0;
    let character = 0;
    for (let i = 0; i < data.length; i += 5) {
        line += data[i]!;
        character = data[i] === 0 ? character + data[i + 1]! : data[i + 1]!;
        const start = text.split(/\r\n|\r|\n/).slice(0, line).reduce((n, row) => n + row.length + 1, 0) + character;
        positions.push({text: text.slice(start, start + data[i + 2]!), kind: data[i + 3]!, modifiers: data[i + 4]!});
    }
    return {legend, positions};
}

test('macro definitions, expansion, conditional uses and undef are highlighted by occurrence identity', () => {
    const text = `#define KIND "FIXED"
#define FLAG
#ifdef FLAG
#endif
#define UNUSED "42"
#define TEMP "42"
#undef TEMP
P=MPC603; SC=100; MODULE; PROBLEM;
DCL A KIND;
MODEND;`;
    const result = analyze(text);
    assert.equal(locations(result.highlights, 'KIND', Kind.Macro).length, 2);
    assert.equal(locations(result.highlights, 'FLAG', Kind.Macro).length, 2);
    assert.equal(locations(result.highlights, 'UNUSED', Kind.Macro).length, 1);
    assert.equal(locations(result.highlights, 'TEMP', Kind.Macro).length, 2);
    assert.deepEqual(locations(result.highlights, 'KIND', Kind.Macro)[0]!.attributes,
        [Attribute.Declaration]);
    assert.equal(locations(result.highlights, 'KIND', Kind.Macro)[1]!.attributes, undefined);
    const {positions, legend} = mapped(text, result.highlights);
    const macroType = legend.getType('macro');
    assert.equal(positions.filter(p => p.text === 'KIND' && p.kind === macroType).length, 2);
    assert.ok(positions.some(p => p.text === 'TEMP' && p.kind === macroType));
});

test('redefined macros have separate declarations but the same semantic token category', () => {
    const text = `#define V "FIXED"
#undef V
#define V "FLOAT"
P=MPC603; SC=100; MODULE; PROBLEM;
DCL X V;
MODEND;`;
    const result = analyze(text);
    assert.equal(result.macros.all.length, 2);
    const names = locations(result.highlights, 'V', Kind.Macro);
    assert.equal(names.filter(h => h.attributes?.includes(Attribute.Declaration)).length, 2);
    assert.equal(names.length, 4);
});

test('predefined macros have no invented declaration highlight', () => {
    const text = 'P=MPC603; SC=100; MODULE; PROBLEM; DCL X CONFIG; MODEND;';
    const result = analyze(text, {CONFIG: 'FIXED'});
    const names = locations(result.highlights, 'CONFIG', Kind.Macro);
    assert.equal(names.length, 1);
    assert.equal(names[0]!.attributes, undefined);
});

test('macro expansion does not paint a generated operator or replacement keyword over an invocation', () => {
    const text = `#define MY_OP "=="
P=MPC603; SC=100; MODULE; PROBLEM;
Main: TASK; IF 2 MY_OP 2 THEN ; FIN; END;
MODEND;`;
    const result = analyze(text);
    const {positions, legend} = mapped(text, result.highlights);
    assert.equal(positions.filter(p => p.text === 'MY_OP' && p.kind === legend.getType('macro')).length, 2);
    assert.equal(positions.filter(p => p.text === 'MY_OP' && p.kind === legend.getType('operator')).length, 0);
});

test('explicit expression operators and constant-expression operators have operator tokens', () => {
    const text = `P=MPC603; SC=100; MODULE; PROBLEM;
DCL Count (1+2) FIXED;
Main: TASK; IF 7 == 7 AND 3 /= 2 THEN ; FIN; END;
MODEND;`;
    const result = analyze(text);
    for (const op of ['+', '==', 'AND', '/=']) {
        assert.ok(locations(result.highlights, op, Kind.Operator).length > 0, op);
    }
    assert.equal(locations(result.highlights, 'TASK', Kind.Operator).length, 0);
    assert.equal(locations(result.highlights, 'FIXED', Kind.Keyword).length, 0);
    assert.equal(locations(result.highlights, '7', Kind.NumberLiteral).length, 0);
});

test('ABS procedure use is a function, not a monadic operator', () => {
    const text = `P=MPC603; SC=100; MODULE; PROBLEM;
ABS: PROC(X FIXED) RETURNS(FIXED); RETURN(X); END;
Main: TASK; IF ABS(7) == 7 THEN ; FIN; END;
MODEND;`;
    const result = analyze(text);
    assert.equal(locations(result.highlights, 'ABS', Kind.Operator).length, 0);
    assert.equal(locations(result.highlights, 'ABS', Kind.Procedure).length, 2);
});

test('ABS without a user declaration is the semantic monadic operator', () => {
    const text = `P=MPC603; SC=100; MODULE; PROBLEM;
Main: TASK; IF ABS(7) == 7 THEN ; FIN; END;
MODEND;`;
    const result = analyze(text);
    assert.equal(locations(result.highlights, 'ABS', Kind.Procedure).length, 0);
    assert.equal(locations(result.highlights, 'ABS', Kind.Operator).length, 1);
    const {positions, legend} = mapped(text, result.highlights);
    assert.ok(positions.some(p => p.text === 'ABS' && p.kind === legend.getType('operator')));
});

test('unparenthesized NOT is an operator, including lexical identifier spellings', () => {
    const text = `P=MPC603; SC=100; MODULE; PROBLEM;
Main: TASK; IF NOT '0'B1 THEN ; FIN; END;
MODEND;`;
    const result = analyze(text);
    assert.equal(locations(result.highlights, 'NOT', Kind.Operator).length, 1);
});


test('include definitions and references are emitted only into their own physical document', () => {
    const includeUri = 'file:///defs.inc';
    const include = '#define IN_HEADER "FIXED"\n';
    const text = '#include "defs.inc"\nP=MPC603; SC=100; MODULE; PROBLEM; DCL X IN_HEADER; MODEND;';
    const result = analyze(text, {}, {[includeUri]: include});
    const matches = locations(result.highlights, 'IN_HEADER', Kind.Macro);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]!.element.location?.source.uri, includeUri);
    assert.equal(matches[1]!.element.location?.source.uri, uri);
    const main = mapped(text, result.highlights);
    assert.equal(main.positions.filter(p => p.text === 'IN_HEADER'
        && p.kind === main.legend.getType('macro')).length, 1);
    const included = new SourceHighlightMapper(new TokenLegend()).map({
        ...fakeDocument(include), uri: includeUri
    } as TextDocument, result.highlights);
    assert.equal(included.data.length, 5);
});

test('full Validator produces symbol, macro and resolved operator highlights in one analysis', async () => {
    const text = `#define T "FIXED"
P=MPC603; SC=100; MODULE; PROBLEM;
DCL X T;
Main: TASK; IF ABS(7) == 7 THEN ; FIN; END;
MODEND;`;
    const validator = new Validator({} as WorkspaceManager, {} as DocumentRegistry, logger);
    const result = await validator.analyze({
        uri, version: 1, getText: () => text
    } as TextDocument, defaultSettings);
    const highlights = result.rootAnalysis.sourceHighlights;
    assert.equal(locations(highlights, 'T', Kind.Macro).length, 2);
    assert.ok(locations(highlights, 'X', Kind.DataObject).length > 0);
    assert.equal(locations(highlights, 'ABS', Kind.Operator).length, 1);
    const rendered = mapped(text, highlights);
    assert.ok(rendered.positions.some(p => p.text === 'T' && p.kind === rendered.legend.getType('macro')));
    assert.ok(rendered.positions.some(p => p.text === 'ABS' && p.kind === rendered.legend.getType('operator')));
});
