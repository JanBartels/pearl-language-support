// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { ArrayTokenStream } from '../../lexer/arrayTokenStream';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { CompilerControlAnalyzer } from '../../semantic/compilerControlAnalyzer';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import { SemanticDiagnosticCode } from '../../semantic/semanticDiagnostic';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { collectBlockComments } from '../analysis';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(text: string) {
    const source = new FileSource('file:///comment-views.P', text);
    const problems = new ProblemCollection();
    const originalTokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const expanded = Preprocessor.createExpanded(
        originalTokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger
    );
    const compilerTokens = new Lexer(expanded.source, problems, logger).tokenize();
    const ast = new Parser(
        new ArrayTokenStream(compilerTokens, expanded.source), problems, logger
    ).parse();
    const compilerComments = collectBlockComments(compilerTokens);
    const semantic = new SemanticAnalyzer().analyze(ast, compilerComments);
    const diagnostics = new CompilerControlAnalyzer().analyze(ast, compilerComments, semantic);
    return { problems: problems.toArray(), diagnostics, compilerComments,
        originalComments: collectBlockComments(originalTokens), source: expanded.source };
}

test('active original /*+G*/ matches the procedure header in ExpandedSource', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
Local: PROC /*+G*/;
END;
MODEND;`);
    assert.ok(!result.diagnostics.some(d =>
        d.code === SemanticDiagnosticCode.GOptionOutsideProcedureHeader));
    assert.equal(result.compilerComments.length, 1);
    assert.equal(result.compilerComments[0].location.source, result.source);
});

test('inactive /*+G*/ remains editor-visible but is not compiler-active', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
#ifdef NOT_DEFINED
/*+G*/
#endif
Local: PROC;
END;
MODEND;`);
    assert.equal(result.originalComments.length, 1);
    assert.equal(result.compilerComments.length, 0);
    assert.equal(result.diagnostics.length, 0);
});

test('macro-generated /*+G*/ is visible to compiler-control analysis', () => {
    const result = analyze(`MODULE Demo; PROBLEM;
#define GOption "/*+G*/"
Local: PROC GOption;
END;
MODEND;`);
    assert.equal(result.compilerComments.length, 1);
    assert.equal(result.compilerComments[0].location.source, result.source);
    assert.ok(!result.diagnostics.some(d =>
        d.code === SemanticDiagnosticCode.GOptionOutsideProcedureHeader));
});
