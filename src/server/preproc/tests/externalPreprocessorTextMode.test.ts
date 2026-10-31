// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Lexer } from '../../lexer/lexer';
import { FileSource } from '../../source/fileSource';
import { ProblemCollection } from '../../core/problemCollection';
import { MacroTable } from '../macroTable';
import { ConditionalStack } from '../conditionalStack';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorContext } from '../preprocessorContext';
import { Preprocessor } from '../preprocessor';
import type { MacroReference } from '../macroReference';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function expand(definitions: boolean) {
    const text = `MODULE Macro;
SYSTEM;
${definitions ? '#define DEKLARATIONEN\n' : ''}#ifdef DEKLARATIONEN
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
VAR Var( Boundary ) FIXED;
MODEND;
`;
    const source = new FileSource('file:///recursive.P', text);
    const registry = { resolveInclude: () => null, addInclude: () => {} } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack()
    );
    const problems = new ProblemCollection();
    const refs: MacroReference[] = [];
    const blocks = new PreprocessorConditionalBlockCollection();
    const result = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, refs, blocks, logger
    );
    return { result, problems };
}

test('external text mode emits complete generated comment before compiler lexing', () => {
    const { result, problems } = expand(false);
    assert.match(result.source.text, /SPC\s+Var\(\s*\/\*\s*0:40\s*\*\/\s*\)\s+FIXED;/);
    assert.equal([...problems].filter(p => p.message === 'Unterminated block comment.').length, 0);
    for (const name of ['VAR', 'Boundary', 'WertIst', 'Count', 'WertEnde']) {
        assert.ok(result.macroReferences.some(r => r.definition.name === name), name);
    }
});

test('external text mode emits declaration without artificial comment', () => {
    const { result } = expand(true);
    assert.match(result.source.text, /DCL\s+Var\(\s*0:40\s*\)\s+FIXED;/);
});
