// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { analyzeFormattedIo, analyzeFormattedIoSource } from '../../validation/tests/formattedIoTestFixture';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';

const full = SemanticDiagnosticCode.InvalidFormattedIoData;
const slice = SemanticDiagnosticCode.InvalidIoSegment;

function codes(body: string, prelude = ''): SemanticDiagnosticCode[] {
    const result = analyzeFormattedIo(body, prelude);
    assert.deepEqual(result.syntax, [], result.syntax.join('\n'));
    return result.diagnostics.map(d => d.code);
}

test('RTOS-UH 5.1: GET and PUT reject whole arrays independently of format lists', () => {
    assert.deepEqual(codes('PUT Array TO Disk BY (3)F(5);'), [full]);
    assert.deepEqual(codes('GET Array FROM Disk BY (3)F(5);'), [full]);
    assert.deepEqual(codes('PUT Array TO Disk;'), [full]);
    assert.deepEqual(codes('GET Array FROM Disk;'), [full]);
});

test('RTOS-UH 5.1: CONVERT TO and FROM reject full fields', () => {
    assert.deepEqual(codes('CONVERT Array TO VarChar20 BY (3)F(5);'), [full]);
    assert.deepEqual(codes('CONVERT Array FROM VarChar20 BY (3)F(5);'), [full]);
    assert.deepEqual(codes('CONVERT Array TO VarChar20;'), [full]);
});

test('RTOS-UH 5.1: field slices are not a legal GET/PUT data form', () => {
    assert.deepEqual(codes('GET Array(1:3) FROM Disk BY (3)F(5);'), [slice]);
    assert.deepEqual(codes('PUT Array(1:3) TO Disk BY (3)F(5);'), [slice]);
    assert.deepEqual(codes('GET Matrix(1,2:3) FROM Disk BY (2)F(5);',
        'DCL Matrix(2,3) FIXED;'), [slice]);
    assert.deepEqual(codes('PUT Matrix(1,2:3) TO Disk BY (2)F(5);',
        'DCL Matrix(2,3) FIXED;'), [slice]);
});

test('RTOS-UH: individual array elements remain valid for formatted I/O', () => {
    assert.deepEqual(codes('PUT Array(1),Array(2),Array(3) TO Disk BY (3)F(5);'), []);
    assert.deepEqual(codes('GET Array(1),Array(2),Array(3) FROM Disk BY (3)F(5);'), []);
    assert.deepEqual(codes('CONVERT Array(1),Array(2),Array(3) TO VarChar20 BY (3)F(5);'), []);
    assert.deepEqual(codes('CONVERT Array(1),Array(2),Array(3) FROM VarChar20 BY (3)F(5);'), []);
});

test('RTOS-UH: invalid fields suppress cascading format mismatch and surplus diagnostics', () => {
    const result = analyzeFormattedIo('PUT Array TO Disk BY B,F(5);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics.map(d => d.code), [full]);
    assert.equal(result.diagnostics[0].severity, SemanticDiagnosticSeverity.Error);
    assert.match(result.diagnostics[0].message, /vollständigen Felder/);
    assert.ok(result.diagnostics[0].location);
});

test('RTOS-UH: formatted slices keep symbol binding for LSP navigation', () => {
    const result = analyzeFormattedIo('GET Array(1:3) FROM Disk BY (3)F(5);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics.map(d => d.code), [slice]);
    const segment = result.statements[0].objects[0] as any;
    assert.equal(result.semantic.bindings.get(segment.array.segments[0].identifier)?.name.value, 'Array');
});

test('RTOS-UH 5.7.5: binary READ/WRITE of whole arrays remains valid', () => {
    const result = analyzeFormattedIoSource(`P=MPC603; SC=2000; MODULE M;
        SYSTEM; Disk:/ED/IO8641;
        PROBLEM; SPC Disk DATION INOUT ALPHIC;
        DCL Array(3) FIXED(15), Matrix(2,3) FIXED(15);
        Main: TASK MAIN;
            WRITE Array,Matrix TO Disk;
            READ Array,Matrix FROM Disk;
        END; MODEND;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
});

test('RTOS-UH: virtual fields are not implicitly expanded into scalar format data', () => {
    assert.deepEqual(codes('PUT Virtual TO Disk BY F(5);',
        'DCL Virtual REF () INV FIXED;'), [full]);
});
