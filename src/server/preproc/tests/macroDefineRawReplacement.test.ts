// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Lexer } from '../../lexer/lexer';
import { TokenKind } from '../../lexer/token';
import { FileSource } from '../../source/fileSource';
import { ProblemCollection } from '../../core/problemCollection';
import { Parser } from '../../parser/parser';
import { MacroTable } from '../macroTable';
import { ConditionalStack } from '../conditionalStack';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorContext } from '../preprocessorContext';
import { Preprocessor } from '../preprocessor';
import { MacroOccurrenceIndex } from '../macroOccurrenceIndex';
import { findMacroReferences } from '../../lsp/findMacroReferences';
import type { MacroReference } from '../macroReference';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
const rootUri = 'file:///tests/TEST.P';
const includeUri = 'file:///tests/testinc.h';

function locationAt(text: string, offset: number) {
    const prefix = text.slice(0, offset).split('\n');
    return { line: prefix.length - 1, character: prefix[prefix.length - 1]!.length };
}

function registryFor(texts: ReadonlyMap<string, string>): DocumentRegistry {
    return {
        get: (uri: string) => {
            const text = texts.get(uri);
            if (text === undefined) return null;
            return {
                positionAt: (offset: number) => locationAt(text, offset),
                offsetAt: (position: { line: number; character: number }) => {
                    const lines = text.split('\n');
                    let offset = 0;
                    for (let i = 0; i < position.line; i++) {
                        offset += lines[i]!.length + 1;
                    }
                    return offset + position.character;
                }
            };
        },
        resolveInclude: (_uri: string, name: string) =>
            name === 'testinc.h' ? { uri: includeUri, getText: () => texts.get(includeUri)! } : null,
        addInclude: () => undefined
    } as unknown as DocumentRegistry;
}

function run(rootText: string, includeText?: string) {
    const texts = new Map([[rootUri, rootText]]);
    if (includeText !== undefined) texts.set(includeUri, includeText);
    const registry = registryFor(texts);
    const problems = new ProblemCollection();
    const references: MacroReference[] = [];
    const macros = new MacroTable();
    macros.define('PEARL90', null);
    macros.define('INOUTP90_', ' ');
    const context = new PreprocessorContext(
        registry, macros, new ConditionalStack(), new PreprocessorConditionalBlockStack()
    );
    const source = new FileSource(rootUri, rootText);
    const stream = Preprocessor.create(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, references, new PreprocessorConditionalBlockCollection(), logger
    );
    new Parser(stream, problems, logger).parse();
    return { registry, problems, references,
        index: new MacroOccurrenceIndex(context.macroDefinitions, references) };
}

test('#define replacement is lexically opaque, even with unmatched PEARL apostrophes', () => {
    const text = '#define AusEinerAnderenWelt "\'Ich bin ein Alien"\n'
        + '#define Progname "\'MyProg\'"\n'
        + '#define Version "\'V1.2.3\'"\n';
    const problems = new ProblemCollection();
    const tokens = new Lexer(new FileSource(rootUri, text), problems, logger).tokenize();
    assert.equal(problems.size(), 0);
    assert.equal(tokens.filter(t => t.kind === TokenKind.PreprocessorText).length, 3);
    const { index } = run(text + 'MODULE; PROBLEM; MODEND;');
    assert.equal(index.all.length, 3);
    assert.equal(index.all[0]!.definition.replacement, "'Ich bin ein Alien");
    assert.equal(index.all[1]!.definition.replacement, "'MyProg'");
    assert.equal(index.all[2]!.definition.replacement, "'V1.2.3'");
});

test('include guard and incomplete apostrophe in #define do not hide macro usage in TEST.P', () => {
    const includeText = `#ifndef _testinc_h_
#define _testinc_h_
SPC GlobProc PROC GLOBAL;
TYPE TestStruct STRUCT [ Element1 FIXED, Element2 FLOAT ];
/* langer Blockkommentar in der Include-Datei */
SPC ASSIGN ENTRY( DATION INOUTP90_ ALPHIC IDENT, CHAR(24)) GLOBAL;
#define AusEinerAnderenWelt "'Ich bin ein Alien"
#endif
`;
    const rootText = `MODULE;
PROBLEM;
#include testinc.h
HuhuTask: TASK PRIO 23;
DCL HuhuA FIXED;
DCL Var FLOAT;
HuhuA = LEN( AusEinerAnderenWelt );
CALL ASSIGN(A1,'/TY');
CALL Boeser_Unterstrich;
END;
MODEND;
`;
    const { index, references, registry, problems } = run(rootText, includeText);
    const useOffset = rootText.indexOf('AusEinerAnderenWelt');
    const defOffset = includeText.indexOf('AusEinerAnderenWelt');
    const atUsage = index.lookupAt({ uri: rootUri, offset: useOffset });
    const atDefinition = index.lookupAt({ uri: includeUri, offset: defOffset });
    if (!atUsage || atUsage === 'ambiguous' || !atDefinition || atDefinition === 'ambiguous') {
        throw new Error('Macro occurrence from included definition or root usage missing');
    }
    assert.equal(atUsage.group.definition, atDefinition.group.definition);
    assert.equal(references.filter(r => r.definition.name === 'AusEinerAnderenWelt').length, 1);
    const fromUse = findMacroReferences(
        index, rootUri, locationAt(rootText, useOffset), true, registry
    );
    const fromDefinition = findMacroReferences(
        index, includeUri, locationAt(includeText, defOffset), true, registry
    );
    assert.deepEqual(fromUse, fromDefinition);
    assert.deepEqual(fromUse?.map(location => location.uri).sort(), [includeUri, rootUri].sort());
    // The replacement is deliberately incomplete PEARL syntax in this reduced
    // fixture, but the #define itself must never cause a lexer diagnostic.
    assert.equal([...problems].some(problem =>
        problem.message === 'Unterminated string literal.'
        && problem.location?.source.uri === includeUri), false);
});

test('unterminated #define replacement ends at newline without consuming the next #define', () => {
    const text = '#define Broken "\'unterminated\n#define Working "FIXED"\n'
        + 'MODULE; PROBLEM; DCL data Working; MODEND;';
    const { index, problems } = run(text);
    assert.equal([...problems].filter(problem =>
        problem.message === 'Unterminated macro replacement text.').length, 1);
    assert.ok(index.all.some(group => group.definition.name === 'Working'));
    assert.equal(index.lookupAt({ uri: rootUri, offset: text.lastIndexOf('Working') }) !== undefined, true);
});
