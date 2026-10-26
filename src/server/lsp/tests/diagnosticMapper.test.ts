// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProblemCollection } from '../../core/problemCollection';
import { FileSource } from '../../source/fileSource';
import { MacroSource } from '../../source/macroSource';
import { mapDiagnostics } from '../diagnosticMapper';
import { Lexer } from '../../lexer/lexer';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const mainUri = 'file:///tests/TEST.P';
const includeUri = 'file:///tests/testinc.h';
const logger: Logger = { info() {}, warn() {}, error() {} };

function documents(texts: ReadonlyMap<string, string>): DocumentRegistry {
    const docs = new Map([...texts].map(([uri, text]) =>
        [uri, TextDocument.create(uri, 'pearl', 1, text)] as const
    ));
    return {
        get: (uri: string) => docs.get(uri) ?? null,
        resolveInclude: (_uri: string, name: string) =>
            name === 'testinc.h' ? docs.get(includeUri) ?? null : null,
        addInclude: () => undefined
    } as unknown as DocumentRegistry;
}

test('macro lexer diagnostic is mapped to the invocation, not replacement offset zero', () => {
    const text = 'MODULE;\nPROBLEM;\n' + '! line\n'.repeat(199)
        + 'HuhuA = LEN( AusEinerAnderenWelt );\n';
    const source = new FileSource(mainUri, text);
    const offset = text.indexOf('AusEinerAnderenWelt');
    const invocation = { source, span: { start: offset, end: offset + 'AusEinerAnderenWelt'.length } };
    const replacement = new MacroSource(invocation, "'Ich bin ein Alien");
    const problems = new ProblemCollection();
    new Lexer(replacement, problems, logger).tokenize();

    const raw = [...problems];
    assert.equal(raw.length, 1);
    assert.equal(raw[0]!.message, 'Unterminated string literal.');
    assert.equal(raw[0]!.location.span.start, 0);

    const mapped = mapDiagnostics(problems, documents(new Map([[mainUri, text]])));
    assert.equal(mapped.size, 1);
    const diagnostic = mapped.get(mainUri)?.[0];
    assert.equal(diagnostic?.message, 'Unterminated string literal.');
    assert.deepEqual(diagnostic?.range, {
        start: { line: 201, character: 'HuhuA = LEN( '.length },
        end: { line: 201, character: 'HuhuA = LEN( '.length + 'AusEinerAnderenWelt'.length }
    });
});

test('nested macro expansion maps a diagnostic through the complete source chain', () => {
    const text = 'X = OUTER;\n';
    const original = new FileSource(mainUri, text);
    const outer = new MacroSource({ source: original, span: { start: 4, end: 9 } }, 'INNER');
    const inner = new MacroSource({ source: outer, span: { start: 0, end: 5 } }, "'broken");
    const problems = new ProblemCollection();
    new Lexer(inner, problems, logger).tokenize();
    const diagnostic = mapDiagnostics(problems, documents(new Map([[mainUri, text]])))
        .get(mainUri)?.[0];
    assert.deepEqual(diagnostic?.range, {
        start: { line: 0, character: 4 }, end: { line: 0, character: 9 }
    });
});

test('diagnostics from ordinary include files keep their own document and position', () => {
    const include = 'DCL valid FIXED;\nDCL bad \u00b7;\n';
    const problems = new ProblemCollection();
    problems.error({ source: new FileSource(includeUri, include), span: { start: 27, end: 28 } },
        'Test diagnostic');
    const mapped = mapDiagnostics(problems, documents(new Map([
        [mainUri, 'MODULE;\n'], [includeUri, include]
    ])));
    assert.equal(mapped.has(mainUri), false);
    assert.deepEqual(mapped.get(includeUri)?.[0]?.range.start,
        TextDocument.create(includeUri, 'pearl', 1, include).positionAt(27));
});

test('preprocessing an included #define reports incomplete expansion at LEN call on line 202', () => {
    const lines = ['#include testinc.h'];
    while (lines.length < 201) lines.push('! filler');
    lines.push('HuhuA = LEN( AusEinerAnderenWelt );');
    const text = lines.join('\n') + '\n';
    const include = '#ifndef _testinc_h_\n#define _testinc_h_\n'
        + '#define AusEinerAnderenWelt "\'Ich bin ein Alien"\n#endif\n';
    const registry = documents(new Map([[mainUri, text], [includeUri, include]]));
    const problems = new ProblemCollection();
    const source = new FileSource(mainUri, text);
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack()
    );
    const preprocessor = Preprocessor.create(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, [], new PreprocessorConditionalBlockCollection(), logger
    );
    while (!preprocessor.eof()) preprocessor.next();
    const literal = [...problems].filter(problem => problem.message === 'Unterminated string literal.');
    assert.equal(literal.length, 1);
    assert.equal(literal[0]!.location.span.start, 0); // Offset in the MacroSource
    const mapped = mapDiagnostics(problems, registry);
    const diagnostic = mapped.get(mainUri)?.find(d => d.message === 'Unterminated string literal.');
    assert.deepEqual(diagnostic?.range, {
        start: { line: 201, character: 'HuhuA = LEN( '.length },
        end: { line: 201, character: 'HuhuA = LEN( '.length + 'AusEinerAnderenWelt'.length }
    });
    assert.equal(mapped.get(includeUri)?.some(d => d.message === 'Unterminated string literal.'), undefined);
});
