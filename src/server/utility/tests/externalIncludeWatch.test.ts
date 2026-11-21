// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSource } from '../../source/fileSource';
import { Lexer } from '../../lexer/lexer';
import { ProblemCollection } from '../../core/problemCollection';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { TranslationUnitNode } from '../../ast/module/translationUnitNode';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { DocumentRegistry } from '../documentRegistry';
import { uriFromFilePath } from '../uriUtils';
import type { Logger } from '../logging/logger';

const quiet: Logger = { info() {}, warn() {}, error() {} };

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-external-watch-'));
  const project = path.join(directory, 'project');
  const lib = path.join(directory, 'library');
  fs.mkdirSync(project);
  fs.mkdirSync(lib);
  const main = uriFromFilePath(path.join(project, 'Main.P'));
  const documents = { get: () => undefined, all: () => [] } as unknown as TextDocuments<TextDocument>;
  const registry = new DocumentRegistry(documents);

  function analyze(text: string, macros: Readonly<Record<string, string | null>> = {}) {
    const document = TextDocument.create(main, 'pearl', 0, text);
    const source = FileSource.fromDocument(document);
    const problems = new ProblemCollection();
    const table = new MacroTable();
    for (const [key, value] of Object.entries(macros)) table.define(key, value);
    const context = new PreprocessorContext(
      registry, table, new ConditionalStack(), new PreprocessorConditionalBlockStack()
    );
    const tokens = new Lexer(source, problems, quiet).tokenize();
    Preprocessor.createExpanded(tokens, source, context, problems, [],
      new PreprocessorConditionalBlockCollection(), quiet);
    const analysis = new Analysis(source, [], new TranslationUnitNode(), problems, [],
      new PreprocessorConditionalBlockCollection());
    const result = AnalysisResult.create(analysis, [analysis],
      [...context.includedSourceUris], context.includeOccurrences,
      [...context.watchedIncludeUris]);
    registry.beginAnalysis(main);
    registry.setAnalysisResult(main, 0, result);
    return { result, context, problems };
  }

  return { directory, project, lib, main, registry, analyze,
    cleanup() { fs.rmSync(directory, { recursive: true, force: true }); } };
}

test('nested external includes are watched regardless of suffix or workspace', () => {
  const f = fixture();
  try {
    const outer = path.join(f.lib, 'lib1.inc');
    const inner = path.join(f.lib, 'nested', 'var.def');
    fs.mkdirSync(path.dirname(inner));
    fs.writeFileSync(outer, '#include nested/var.def\n');
    fs.writeFileSync(inner, 'TYPE ExternalScalar FIXED;\n');
    const first = f.analyze('#include InclDir/lib1.inc\n', { InclDir: `'${f.lib}'` });
    assert.deepEqual(new Set(first.result.includedSourceUris),
      new Set([uriFromFilePath(outer), uriFromFilePath(inner)]));
    assert.deepEqual(new Set(f.registry.getWatchedIncludeUris()),
      new Set([uriFromFilePath(outer), uriFromFilePath(inner)]));
    assert.deepEqual(f.registry.invalidateUri(uriFromFilePath(inner)), [f.main]);
  } finally { f.cleanup(); }
});

test('a deleted external include remains watched and its recreation invalidates the root', () => {
  const f = fixture();
  try {
    const external = path.join(f.lib, 'lib1.h');
    fs.writeFileSync(external, 'TYPE ExtScalar FIXED;\n');
    // Use a plain path in the directive to isolate dependency behavior.
    const first = f.analyze(`#include ${external}\n`);
    const target = uriFromFilePath(external);
    assert.ok(first.result.includedSourceUris?.includes(target));
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [target]);
    fs.unlinkSync(external);
    assert.deepEqual(f.registry.invalidateUri(target), [f.main]);
    const missing = f.analyze(`#include ${external}\n`);
    assert.ok(!missing.result.includedSourceUris?.includes(target));
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [target],
      'failed #include must retain its watch dependency');
    assert.deepEqual(f.registry.getIncludeContextCandidates(target, 0), [],
      'a missing target must not become a semantic include context');
    fs.writeFileSync(external, 'TYPE ExtScalar FLOAT;\n');
    assert.deepEqual(f.registry.invalidateUri(target), [f.main]);
    const recovered = f.analyze(`#include ${external}\n`);
    assert.ok(recovered.result.includedSourceUris?.includes(target));
  } finally { f.cleanup(); }
});

test('watch edges replace former include targets after a conditional change', () => {
  const f = fixture();
  try {
    const a = path.join(f.lib, 'A.inc');
    const b = path.join(f.lib, 'B.inc');
    fs.writeFileSync(a, 'TYPE A FIXED;\n');
    fs.writeFileSync(b, 'TYPE B FLOAT;\n');
    const text = `#ifdef OPTION_A\n#include ${a}\n#else\n#include ${b}\n#endif\n`;
    f.analyze(text, { OPTION_A: null });
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [uriFromFilePath(a)]);
    f.analyze(text);
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [uriFromFilePath(b)]);
    assert.deepEqual(f.registry.invalidateUri(uriFromFilePath(a)), []);
    assert.deepEqual(f.registry.invalidateUri(uriFromFilePath(b)), [f.main]);
  } finally { f.cleanup(); }
});

test('closing a root removes watchers even for currently missing include paths', () => {
  const f = fixture();
  try {
    const missing = path.join(f.lib, 'not-created.any');
    f.analyze(`#include ${missing}\n`);
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [uriFromFilePath(missing)]);
    f.registry.closeTranslationUnit(f.main);
    assert.deepEqual(f.registry.getWatchedIncludeUris(), []);
    assert.deepEqual(f.registry.invalidateUri(uriFromFilePath(missing)), []);
  } finally { f.cleanup(); }
});

test('shared include stays watched until the last parent translation unit closes', () => {
  const f = fixture();
  try {
    const target = uriFromFilePath(path.join(f.lib, 'common.inc'));
    const second = uriFromFilePath(path.join(f.project, 'Other.P'));
    f.analyze(`#include ${path.join(f.lib, 'common.inc')}\n`);
    const secondSource = new FileSource(second, 'MODULE; PROBLEM; MODEND;');
    const secondAnalysis = new Analysis(secondSource, [], new TranslationUnitNode(),
      new ProblemCollection(), [], new PreprocessorConditionalBlockCollection());
    const secondResult = AnalysisResult.create(secondAnalysis, [secondAnalysis], [], [], [target]);
    f.registry.beginAnalysis(second);
    f.registry.setAnalysisResult(second, 0, secondResult);
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [target]);
    f.registry.closeTranslationUnit(f.main);
    assert.deepEqual(f.registry.getWatchedIncludeUris(), [target]);
    assert.deepEqual(f.registry.invalidateUri(target), [second]);
    f.registry.closeTranslationUnit(second);
    assert.deepEqual(f.registry.getWatchedIncludeUris(), []);
  } finally { f.cleanup(); }
});
