// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../source/fileSource';
import { Lexer } from '../../lexer/lexer';
import { ArrayTokenStream } from '../../lexer/arrayTokenStream';
import { Parser } from '../../parser/parser';
import { ProblemCollection } from '../../core/problemCollection';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import type { MacroReference } from '../../preproc/macroReference';

const logger: Logger = { info() {}, warn() {}, error() {} };

function run(withDeclarations: boolean) {
    const source = new FileSource('file:///RecursiveMacros.P', `P=MPC603;
SC=2000;
MODULE Macro;
SYSTEM;
PROBLEM;
${withDeclarations ? '#define DEKLARATIONEN\n' : ''}
#ifdef DEKLARATIONEN
#define VAR "DCL"
#define WertIst " "
#define WertEnde " "
#else
#define VAR "SPC"
#define WertIst "/*"
#define WertEnde "*/"
#endif
#define Count "40"
#define Boundary "WertIst 0:Count WertEnde"
VAR Var( Boundary ) FIXED GLOBAL;
MODEND;
`);
    const problems = new ProblemCollection();
    const registry = { resolveInclude: () => null, addInclude: () => {} } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const references: MacroReference[] = [];
    const expanded = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, references, new PreprocessorConditionalBlockCollection(), logger
    );
    const tokens = new Lexer(expanded.source, problems, logger).tokenize();
    new Parser(new ArrayTokenStream(tokens, expanded.source), problems, logger).parse();
    return { expanded, problems, references, source, context };
}

test('external macro comments survive compiler lexing in specification mode', () => {
    const { expanded, problems } = run(false);
    assert.match(expanded.source.text, /SPC\s+Var\(\s*\/\*\s*0:40\s*\*\/\s*\)\s+FIXED;/);
    assert.ok(![...problems].some(p => p.message === 'Unterminated block comment.'));
    assert.ok(![...problems].some(p => p.message === "Expected 'MODEND'."));
    assert.equal(expanded.macroReferences.length >= 5, true);
});

test('external macro declaration mode survives compiler lexing', () => {
    const { expanded, problems } = run(true);
    assert.match(expanded.source.text, /DCL\s+Var\(\s*0:40\s*\)\s+FIXED;/);
    assert.ok(![...problems].some(p => p.message === 'Unterminated block comment.'));
});

import { MacroOccurrenceIndex } from '../macroOccurrenceIndex';

test('Boundary invocation has one unambiguous macro reference in text mode', () => {
    const { expanded, source, context } = run(false);
    const boundaryOffset = source.text.lastIndexOf('Boundary )');
    assert.ok(boundaryOffset >= 0);
    const refs = expanded.macroReferences;
    const direct = refs.filter(ref => ref.location.source === source
        && ref.location.span.start === boundaryOffset);
    assert.equal(direct.length, 1);
    assert.equal(direct[0]?.definition.name, 'Boundary');
    const index = new MacroOccurrenceIndex(context.macroDefinitions, refs);
    const match = index.lookupAt({ uri: source.uri, offset: boundaryOffset + 2 });
    assert.ok(match && match !== 'ambiguous');
    if (match && match !== 'ambiguous') assert.equal(match.group.definition.name, 'Boundary');
});
