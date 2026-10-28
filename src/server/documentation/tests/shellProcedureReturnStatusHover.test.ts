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
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { AstLookupResultDocumentationProvider } from '../astLookupResultDocumentationProvider';

const logger: Logger = { info() {}, warn() {}, error() {} };

function make(text: string) {
    const source = new FileSource('file:///shell-return.p', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);

    return {
        problems,
        semantic,
        hoverAt(fragment: string, occurrence = 0): string {
            const offsets = [...text.matchAll(new RegExp(fragment.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
            const offset = offsets[occurrence]?.index;
            assert.notEqual(offset, undefined);
            const lookup = ast.lookupSourceValue({ uri: source.uri, offset: offset! });
            assert.ok(lookup, `AST lookup: ${fragment}`);
            const documentation = AstLookupResultDocumentationProvider.getDocumentation(lookup, semantic);
            assert.ok(documentation, `Hover: ${fragment}`);
            return documentation;
        }
    };
}

function assertShellStatus(documentation: string): void {
    assert.match(documentation, /'1'B[^\n]*Erfolg/);
    assert.match(documentation, /'0'B[^\n]*Fehler/);
    assert.match(documentation, /WAIT/);
    assert.match(documentation, /--/);
}

test('SHELLMODULE command and PROC hover explain BIT(1) success and error', () => {
    const p = make(`SHELLMODULE Test;
Sages:'ECHOTX';
PROBLEM;
Sages: PROC((Stdin, Stdout, Stderr) DATION INOUT ALPHIC IDENT,
    Length FIXED, Text CHAR(255)) RETURNS(BIT(1));
    RETURN('1'B);
END;
MODEND;`);
    assert.equal(p.problems.size(), 0);
    assert.equal(p.semantic.shellCommandsByProcedure.size, 1);

    assertShellStatus(p.hoverAt('Sages', 0)); // shell mapping
    assertShellStatus(p.hoverAt('ECHOTX'));    // command name
    assertShellStatus(p.hoverAt('Sages', 1)); // PROC declaration
    assertShellStatus(p.hoverAt('RETURNS'));  // shell return type
    assert.match(p.hoverAt('Sages', 1), /\*\*Signature:\*\*/);
});

test('ordinary PROC returning BIT(1) does not inherit shell status meaning', () => {
    const p = make(`MODULE Test; PROBLEM;
Ordinary: PROC RETURNS(BIT(1));
    RETURN('1'B);
END;
MODEND;`);
    assert.doesNotMatch(p.hoverAt('Ordinary'), /Shell-Rückgabecode/);
    assert.doesNotMatch(p.hoverAt('RETURNS'), /Shell-Rückgabecode/);
});

test('unmapped PROC within SHELLMODULE has no shell return status explanation', () => {
    const p = make(`SHELLMODULE Test; PROBLEM;
Other: PROC RETURNS(BIT(1)); RETURN('1'B); END;
MODEND;`);
    assert.doesNotMatch(p.hoverAt('Other'), /Shell-Rückgabecode/);
});
