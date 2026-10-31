// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../source/fileSource';
import { Lexer } from '../../lexer/lexer';
import { ProblemCollection } from '../../core/problemCollection';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { collectBlockComments } from '../analysis';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

test('inactive compiler control comments remain in source but not active semantic view', () => {
    const source = new FileSource('file:///comment-views.p', `MODULE Test;
PROBLEM;
#ifdef UNDEFINED_FLAG
/*+G*/
#else
/*+M*/
#endif
MODEND;
`);
    const problems = new ProblemCollection();
    const inputTokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    Preprocessor.createExpanded(
        inputTokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger
    );

    const allOriginal = collectBlockComments(inputTokens);
    assert.equal(allOriginal.length, 2);
    assert.equal(context.activeBlockComments.length, 1);
    const active = context.activeBlockComments[0];
    assert.equal(active.location.source.getText(active.location.span), '/*+M*/');
});
