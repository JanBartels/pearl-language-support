// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { FileSource } from '../../source/fileSource';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

const signature = `PROC((Stdin, Stdout, Stderr) DATION INOUT ALPHIC IDENT,
    Length FIXED, Text CHAR(255)) RETURNS(BIT(1));
    RETURN('1'B);
END;`;

function analyze(commands: readonly [string, string][]) {
    const text = `P=MPC603; SC=2000; SHELLMODULE M;\n${commands.map(([p, n]) => `${p}:'${n}';`).join('\n')}\n`
        + `PROBLEM;\n${commands.map(([p]) => `${p}: ${signature}`).join('\n')}\nMODEND;`;
    const source = new FileSource('file:///shell-case.P', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    return { problems, semantic };
}

test('uppercase SHELLMODULE command names are valid', () => {
    const result = analyze([['Say', 'ECHOTX']]);
    assert.equal(result.problems.size(), 0);
    assert.deepEqual(result.semantic.diagnostics, []);
});

test('lowercase shell command name produces a warning preserving the spelling', () => {
    const result = analyze([['Say', 'EchoTx']]);
    assert.equal(result.problems.size(), 0);
    const invalid = result.semantic.diagnostics.filter(d =>
        d.code === SemanticDiagnosticCode.InvalidShellCommandName);
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].severity, SemanticDiagnosticSeverity.Warning);
    assert.match(invalid[0].message, /'EchoTx'/);
    assert.match(invalid[0].message, /sollte/);
});

test('duplicate shell command detection uses canonical comparison but original spelling in messages', () => {
    const result = analyze([['SayOne', 'HELLO'], ['SayTwo', 'HeLLo']]);
    assert.equal(result.problems.size(), 0);
    const duplicate = result.semantic.diagnostics.filter(d =>
        d.code === SemanticDiagnosticCode.DuplicateShellCommand);
    assert.equal(duplicate.length, 1);
    assert.equal(duplicate[0].severity, SemanticDiagnosticSeverity.Error);
    assert.match(duplicate[0].message, /'HeLLo'/);
    assert.ok(result.semantic.diagnostics.some(d =>
        d.code === SemanticDiagnosticCode.InvalidShellCommandName));
});

test('distinct uppercase shell commands do not collide', () => {
    const result = analyze([['SayOne', 'HELLO'], ['SayTwo', 'WORLD']]);
    assert.equal(result.problems.size(), 0);
    assert.deepEqual(result.semantic.diagnostics, []);
});
