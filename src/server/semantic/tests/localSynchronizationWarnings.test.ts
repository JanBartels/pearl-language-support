// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(code: string) {
    const source = new FileSource('file:///local-sema-bolt.pearl',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    return { syntax: problems.toArray().map(p => p.message), diagnostics: semantic.diagnostics };
}

const warnings = (result: ReturnType<typeof analyze>) => result.diagnostics.filter(
    d => d.code === SemanticDiagnosticCode.LocalSynchronizationObject);

test('local SEMA/BOLT objects warn, module-level objects do not', () => {
    const result = analyze(`DCL Shared SEMA; DCL SharedBolt BOLT;
        Worker: PROC;
            DCL LocalS SEMA;
            DCL LocalB BOLT;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(warnings(result).length, 2);
    assert.ok(warnings(result).every(d => d.severity === SemanticDiagnosticSeverity.Warning));
});

test('nested structures containing synchronization values warn, REF components do not', () => {
    const result = analyze(`TYPE Inner STRUCT[Lock SEMA];
        TYPE Outer STRUCT[Part Inner, Pointer REF BOLT];
        Worker: PROC;
            DCL Local Outer;
            DCL Pointer REF SEMA;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(warnings(result).length, 1);
});

test('value parameters warn while REF and IDENT parameters are exempt', () => {
    const result = analyze(`Worker: PROC(A SEMA, B REF SEMA, C BOLT IDENT);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(warnings(result).length, 1);
    assert.ok(warnings(result)[0].message.includes('Wertparameter'));
});


test('direct synchronization components in local structures warn once per object', () => {
    const result = analyze(`Worker: PROC;
        DCL State STRUCT[Gate SEMA, Lock BOLT];
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(warnings(result).length, 1);
});

test('module-level structures with synchronization components remain valid', () => {
    const result = analyze(`TYPE State STRUCT[Gate SEMA, Lock BOLT];
        DCL Shared State;
        Main: TASK;
            REQUEST Shared.Gate;
            ENTER Shared.Lock;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics.map(d => d.message), []);
});

test('REF boundaries suppress local object warnings even for nested synchronization types', () => {
    const result = analyze(`TYPE Inner STRUCT[Gate SEMA, Lock BOLT];
        Worker: PROC;
            DCL P REF Inner;
            DCL RefState STRUCT[P REF Inner];
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(warnings(result), []);
});
