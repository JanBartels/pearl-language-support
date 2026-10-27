// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { collectBlockComments } from '../../validation/analysis';
import { CompilerControlAnalyzer } from '../compilerControlAnalyzer';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(text: string) {
    const source = new FileSource('file:///g-option.p', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(
        tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger
    );
    const ast = new Parser(stream, problems, logger).parse();
    const semantics = new SemanticAnalyzer().analyze(ast);
    const diagnostics = new CompilerControlAnalyzer().analyze(
        ast, collectBlockComments(tokens), semantics
    );
    return { problems: problems.toArray(), diagnostics };
}

test('RTOS-UH 5.4.6: /*+G*/ works on PROC without GLOBAL', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
LocalProc: PROC /*+G*/;
END;
MODEND;`);
    assert.deepEqual(result.problems.map(p => p.message), []);
    assert.deepEqual(result.diagnostics, []);
});

test('RTOS-UH 5.4.6: /*+G*/ and GLOBAL are independent options', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
PublicProc: PROC /*+G*/ GLOBAL;
END;
MODEND;`);
    assert.deepEqual(result.problems.map(p => p.message), []);
    assert.deepEqual(result.diagnostics, []);
});

test('existing restriction remains: /*+G*/ following first TASK is an error', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
Runner: TASK; END;
LocalProc: PROC /*+G*/;
END;
MODEND;`);
    assert.deepEqual(result.problems.map(p => p.message), []);
    assert.ok(result.diagnostics.some(
        d => d.code === SemanticDiagnosticCode.GProcedureAfterFirstTask
            && d.severity === 0
    ));
});

test('misplaced /*+G*/ still generates its existing warning', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
/*+G*/
LocalProc: PROC;
END;
MODEND;`);
    assert.ok(result.diagnostics.some(
        d => d.code === SemanticDiagnosticCode.GOptionOutsideProcedureHeader
    ));
});
