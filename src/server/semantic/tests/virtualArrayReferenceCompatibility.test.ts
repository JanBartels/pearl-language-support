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
import { isTypeAssignable } from '../semanticTypeComparison';
import { SemanticTypeKind } from '../semanticType';
import type { SemanticType } from '../semanticType';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const source = new FileSource('file:///virtual-reference-compatibility.P',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    return {
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error),
        warnings: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Warning)
    };
}

const declarations = `
    DCL AF(100) FIXED;
    DCL AF2(2,3) FIXED;
    DCL CF(100) CHAR(3);
    DCL RF REF () FIXED;
    DCL RF2 REF (,) FIXED;
    DCL RC REF () CHAR(3);
`;

test('RTOS-UH: a concrete one-dimensional FIXED field can be assigned to REF () FIXED', () => {
    const r = analyze(`P: PROC; ${declarations} RF = AF; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('virtual references accept matching concrete array ranks and element types', () => {
    const r = analyze(`P: PROC; ${declarations} RF2 = AF2; RC = CF; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('virtual reference compatibility is directional, rejects wrong ranks and types', () => {
    const r = analyze(`P: PROC; ${declarations}
        RF = AF2;
        RF = CF;
        RF2 = AF;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidAssignmentValueType,
        SemanticDiagnosticCode.InvalidAssignmentValueType,
        SemanticDiagnosticCode.InvalidAssignmentValueType
    ]);
});

test('REF () FIXED value parameters accept concrete arrays and virtual references', () => {
    const r = analyze(`V: PROC(X REF () FIXED); END;
        P: PROC; ${declarations}
            V(AF); V(RF);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('REF () FIXED parameter passing rejects wrong rank and element type', () => {
    const r = analyze(`V: PROC(X REF () FIXED); END;
        P: PROC; ${declarations}
            V(AF2); V(CF);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('REF () FIXED IDENT requires a REF variable and accepts compatible REF concrete arrays', () => {
    const r = analyze(`V: PROC(X REF () FIXED IDENT); END;
        P: PROC; ${declarations}
            V(RF); V(RF2); V(AF);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidIdentificationArgument
    ]);
});

test('REF target invariance remains directional even for virtual arrays', () => {
    const vir = { kind: SemanticTypeKind.VirtualArray, rank: 1,
        elementType: { kind: SemanticTypeKind.Fixed, precision: 15 } } as const satisfies SemanticType;
    const arr = { kind: SemanticTypeKind.Array,
        dimensions: [{ lowerBound: 1n, upperBound: 100n }],
        elementType: { kind: SemanticTypeKind.Fixed, precision: 15 } } as const satisfies SemanticType;
    const writable = { kind: SemanticTypeKind.Reference, target: vir, targetInvariant: false } as const satisfies SemanticType;
    const readOnly = { kind: SemanticTypeKind.Reference, target: arr, targetInvariant: true } as const satisfies SemanticType;
    const plain = { kind: SemanticTypeKind.Reference, target: arr, targetInvariant: false } as const satisfies SemanticType;
    assert.equal(isTypeAssignable(writable, plain), true);
    assert.equal(isTypeAssignable(writable, readOnly), false);
    assert.equal(isTypeAssignable({ ...writable, targetInvariant: true }, readOnly), true);
    assert.equal(isTypeAssignable(plain, writable), false);
});
