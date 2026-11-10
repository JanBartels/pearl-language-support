// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { analyzeFormattedIo } from '../../validation/tests/formattedIoTestFixture';

const mismatch = SemanticDiagnosticCode.IncompatibleFormattedIoFormat;
const repeated = SemanticDiagnosticCode.ImplicitFormatListRepetition;
const excess = SemanticDiagnosticCode.ExcessFormattedIoFormats;

function diagnostics(source: string, prelude = '', tail = '') {
    const analysis = analyzeFormattedIo(source, prelude, tail);
    assert.deepEqual(analysis.syntax, [], analysis.syntax.join('\n'));
    return analysis.diagnostics;
}

test('formats consume exactly one data item; RST, X and SKIP do not consume', () => {
    assert.deepEqual(diagnostics(`
        PUT A,VarBit,B TO Disk BY RST(FixedErr1),SKIP,F(5),X(3),B1(8),E(10,3);
        GET A,VarBit FROM Disk BY RST(Error31),F(3),X,B;
    `), []);
});

test('data/format mismatches point to the offending format and reference the data object', () => {
    const result = diagnostics('PUT A, VarBit, B TO Disk BY F(5),F(5),E(12,4);');
    assert.deepEqual(result.map(d => d.code), [mismatch]);
    assert.match(result[0].message, /VarBit/);
    assert.match(result[0].message, /BIT|Bit/);
    assert.equal(result[0].severity, SemanticDiagnosticSeverity.Error);
    assert.equal(result[0].relatedLocations?.length, 1);
});

test('B, B1, B3 and B4 accept BIT but reject CHAR', () => {
    assert.deepEqual(diagnostics('PUT VarBit,VarBit,VarBit,VarBit TO Disk BY B,B1,B3,B4;'), []);
    assert.deepEqual(diagnostics('PUT VarChar20 TO Disk BY B1;').map(d => d.code), [mismatch]);
});

test('F/E accept FIXED and FLOAT; A accepts CHAR; LIST accepts elemental types', () => {
    assert.deepEqual(diagnostics('PUT A,B,VarChar20,VarBit TO Disk BY F(5),E(10,3),A,LIST;'), []);
    assert.deepEqual(diagnostics('PUT VarBit TO Disk BY E(10,3);').map(d => d.code), [mismatch]);
});

test('explicit repetition and nested groups do not produce implicit-repeat warnings', () => {
    assert.deepEqual(diagnostics('PUT A,B,A,B TO Disk BY (2)(F(5),E(10,3));'), []);
    assert.deepEqual(diagnostics('PUT A,B,A TO Disk BY (3)F(5);'), []);
});

test('short list is legal but triggers one implicit-repeat warning', () => {
    const results = diagnostics('PUT A,VarBit,B TO Disk BY F(5),B;');
    assert.deepEqual(results.map(d => d.code), [repeated, excess]);
    assert.equal(results[0].severity, SemanticDiagnosticSeverity.Warning);
});

test('implicit repeat still validates the type reached after wrap-around', () => {
    const results = diagnostics('PUT A,VarBit,VarChar20 TO Disk BY F(5),B;');
    assert.deepEqual(results.map(d => d.code), [repeated, mismatch, excess]);
    assert.match(results[1].message, /VarChar20/);
});

test('RTOS-UH resumes at the last block repetition, not the first format', () => {
    // After F,B,E have been consumed the cursor resumes at (1)(B),
    // then proceeds to E; restarting at F would incorrectly reject BIT.
    const results = diagnostics('PUT A,VarBit,B,VarBit,A TO Disk BY F(5),(1)(B),E(10,3);');
    assert.deepEqual(results.map(d => d.code), [repeated]);
});

test('FORMAT R reference, including forward declaration, participates in execution', () => {
    assert.deepEqual(diagnostics('PUT A,B TO Disk BY R(Ftab);', '',
        'Ftab: FORMAT ((2)(X(1),F(5)));'), []);
    const results = diagnostics('PUT A,VarBit TO Disk BY R(Ftab);', '',
        'Ftab: FORMAT ((2)(F(5)));');
    assert.deepEqual(results.map(d => d.code), [mismatch]);
});

test('RTOS-UH rejects whole fields and formatted I/O slices', () => {
    const code = SemanticDiagnosticCode.InvalidFormattedIoData;
    const slice = SemanticDiagnosticCode.InvalidIoSegment;
    assert.deepEqual(diagnostics('PUT Array TO Disk BY (3)F(4);').map(d => d.code), [code]);
    assert.deepEqual(diagnostics('GET Array FROM Disk BY (3)F(4);').map(d => d.code), [code]);
    assert.deepEqual(diagnostics('GET Array(1:3) FROM Disk BY (3)F(4);').map(d => d.code), [slice]);
});

test('unknown repetition count prevents speculative pairing diagnostics', () => {
    assert.deepEqual(diagnostics('PUT A,VarBit TO Disk BY (FixedErr1)(F(5),B);'), []);
});

test('CONVERT obeys the same sequence without a DATION', () => {
    assert.deepEqual(diagnostics('CONVERT A FROM VarChar20 BY RST(FixedErr1),F(5);'), []);
    assert.deepEqual(diagnostics("CONVERT 'X',A TO VarChar20 BY A,F(5);"), []);
});

test('invalid operands do not cause cascading format-execution warnings', () => {
    assert.deepEqual(diagnostics('GET Array(3:2) FROM Disk BY F(4);').map(d => d.code),
        [SemanticDiagnosticCode.InvalidIoSegment]);
});


test('named constant repetition factors are evaluated with scalar data objects', () => {
    assert.deepEqual(diagnostics('PUT A,A,A TO Disk BY (Count)F(4);',
        'DCL Count INV FIXED INIT(3);'), []);
});

test('CLOCK and DURATION use T and D, not numeric formats', () => {
    assert.deepEqual(diagnostics('PUT Uhr,Dauer TO Disk BY T(8),D(20);',
        'DCL Uhr CLOCK, Dauer DUR;'), []);
    assert.deepEqual(diagnostics('PUT Uhr TO Disk BY F(8);',
        'DCL Uhr CLOCK;').map(d => d.code), [mismatch]);
});

test('virtual fields are not treated as formatted scalar data', () => {
    const results = diagnostics('PUT Virtual TO Disk BY F(5);',
        'DCL Virtual REF () INV FIXED;');
    assert.deepEqual(results.map(d => d.code), [SemanticDiagnosticCode.InvalidFormattedIoData]);
});

test('real-world regression: two RST controls and B1/B select three BIT values', () => {
    const results = diagnostics(`PUT B32,B32.BIT(1),B32.BIT(1) TO Disk
        BY RST(Err1),RST(Err2),B1(32),B,B1,SKIP;`,
        'DCL Err1 FIXED(15), Err2 FIXED, B32 BIT(32);');
    assert.deepEqual(results, []);
});

test('FORMAT named repetition factor is evaluated in its declaration scope', () => {
    const results = diagnostics('PUT A,VarBit TO Disk BY R(Ftab);',
        'DCL Count INV FIXED INIT(1);',
        'Ftab: FORMAT ((Count)F(5),B);');
    assert.deepEqual(results, []);
});

test('nested R references resolve in their own FORMAT scope', () => {
    const results = diagnostics('PUT VarBit TO Disk BY R(Outer);',
        'Outer: FORMAT (R(Inner)); Inner: FORMAT (B4(8));');
    assert.deepEqual(results, []);
});

test('implicit restart preserves the suffix after a repeated block inside R', () => {
    const results = diagnostics('PUT A,VarBit,B,VarBit,A TO Disk BY R(Ftab);',
        'Ftab: FORMAT (F(5),(1)(B),E(10,3));');
    assert.deepEqual(results.map(d => d.code), [repeated]);
});

test('nested R declarations retain their suffix on implicit restart from the last block', () => {
    // Outer: F, Inner: (1)(B), E, Outer suffix: A.
    // After the first pass, the next pass must resume at B (inside Inner),
    // then execute Inner's E and Outer's A. Starting from F would be wrong.
    const results = diagnostics('PUT A,VarBit,B,VarChar20,VarBit,B,VarChar20 TO Disk BY R(Outer);',
        '', 'Outer: FORMAT (F(5),R(Inner),A); Inner: FORMAT ((1)(B),E(10,3));');
    assert.deepEqual(results.map(d => d.code), [repeated]);
});

test('the innermost last block is the restart point, including nested FORMAT groups', () => {
    // The last executed block is (1)(B), not the outer (2)(...) group.
    // Restarting the outer group would use A on VarBit and cause a mismatch.
    const results = diagnostics(`PUT A,VarChar20,VarBit,B,VarChar20,VarBit,B,VarBit,B
        TO Disk BY F(5),(2)(A,(1)(B),E(10,3));`);
    assert.deepEqual(results.map(d => d.code), [repeated]);
});

test('multiple consecutive R uses of one FORMAT are not confused with recursion', () => {
    assert.deepEqual(diagnostics('PUT A,VarBit,A TO Disk BY R(Ftab),B,R(Ftab);',
        '', 'Ftab: FORMAT (F(4));'), []);
});

test('three nested FORMAT references work; cyclic declarations remain undecidable', () => {
    assert.deepEqual(diagnostics('PUT A TO Disk BY R(F1);', '',
        'F1: FORMAT (R(F2)); F2: FORMAT (R(F3)); F3: FORMAT (F(4));'), []);
    assert.deepEqual(diagnostics('PUT A TO Disk BY R(F1);', '',
        'F1: FORMAT (R(F2)); F2: FORMAT (R(F1));'), []);
});

test('a whole field is rejected before format type diagnostics are emitted', () => {
    const results = diagnostics('PUT Array TO Disk BY (3)B;');
    assert.deepEqual(results.map(d => d.code), [SemanticDiagnosticCode.InvalidFormattedIoData]);
});

test('explicit repetition with a scalar list checks the last incompatible object', () => {
    const results = diagnostics('PUT A,A,A,VarBit TO Disk BY (3)F(5),F(5);');
    assert.deepEqual(results.map(d => d.code), [mismatch]);
    assert.match(results[0].message, /VarBit/);
});

test('large homogeneous format repetitions are not expanded into surplus diagnostics', () => {
    const results = diagnostics('PUT A TO Disk BY (100000)F(5);');
    assert.deepEqual(results.map(d => d.code), [excess]);
});

test('scalar data are not multiplied by their declared field dimensions', () => {
    assert.deepEqual(diagnostics('PUT Array,A TO Disk BY F(5),F(5);').map(d => d.code),
        [SemanticDiagnosticCode.InvalidFormattedIoData]);
});

test('multi-dimensional formatted I/O slice is rejected', () => {
    const results = diagnostics('GET Matrix(2,1:3) FROM Disk BY (3)F(5);',
        'DCL Matrix(2,3) FIXED;');
    assert.deepEqual(results.map(d => d.code), [SemanticDiagnosticCode.InvalidIoSegment]);
});

test('a whole virtual field cannot hide an earlier provable formatted I/O error', () => {
    const results = diagnostics('PUT VarBit,Virtual,A TO Disk BY F(5),B,A;',
        'DCL Virtual REF () INV FIXED;');
    assert.deepEqual(results.map(d => d.code), [SemanticDiagnosticCode.InvalidFormattedIoData]);
});

test('a format list with only controls does not hang or invent a mismatch', () => {
    assert.deepEqual(diagnostics('PUT A TO Disk BY SKIP,X(2),RST(FixedErr1);'), []);
});


test('large repeated controls do not hide the following consuming format', () => {
    const results = diagnostics('PUT VarBit TO Disk BY (1000000)SKIP,F(5);');
    assert.deepEqual(results.map(d => d.code), [mismatch]);
    assert.match(results[0].message, /VarBit/);
});

test('large repeated controls inside a FORMAT reference stay non-consuming', () => {
    const results = diagnostics('PUT VarBit TO Disk BY (100000)R(Controls),F(5);',
        '', 'Controls: FORMAT (X);');
    assert.deepEqual(results.map(d => d.code), [mismatch]);
});

test('large repeated scalar format group reports surplus data formats', () => {
    const results = diagnostics('PUT A TO Disk BY (4096)(F(5)),B;');
    assert.deepEqual(results.map(d => d.code), [excess]);
});

test('fixed multidimensional segments are rejected independent of format type', () => {
    const results = diagnostics('GET Matrix(2,1:3) FROM Disk BY (3)B;',
        'DCL Matrix(2,3) FIXED;');
    assert.deepEqual(results.map(d => d.code), [SemanticDiagnosticCode.InvalidIoSegment]);
});

test('dynamically bounded slices are rejected independently of their bounds', () => {
    const results = diagnostics('GET Array(Lower:3),VarBit FROM Disk BY F(5),F(5);',
        'DCL Lower FIXED;');
    assert.deepEqual(results.map(d => d.code), [SemanticDiagnosticCode.InvalidIoSegment]);
});

test('many repeated multi-control FORMAT references do not hide the next mismatch', () => {
    const result = diagnostics('PUT VarBit TO Disk BY (100000)R(Controls),F(5);', '',
        'Controls: FORMAT (SKIP,X(2));');
    assert.deepEqual(result.map(d => d.code), [mismatch]);
});

test('nested control-only R declarations do not exhaust the cursor budget', () => {
    const result = diagnostics('PUT VarBit TO Disk BY (100000)R(Outer),F(5);', '',
        'Outer: FORMAT (R(Inner),X); Inner: FORMAT (SKIP);');
    assert.deepEqual(result.map(d => d.code), [mismatch]);
});

test('huge direct control-only group preserves the implicit restart point', () => {
    const result = diagnostics('PUT VarBit,VarBit TO Disk BY (1000000)(SKIP,X),B;');
    assert.deepEqual(result.map(d => d.code), [repeated]);
});

test('large scalar repetition still checks the next scalar data item', () => {
    const result = diagnostics('PUT A,VarBit TO Disk BY (4096)(X,F(5)),B;');
    assert.deepEqual(result.map(d => d.code), [mismatch, excess]);
});

test('large scalar control groups do not hide an invalid following format', () => {
    const result = diagnostics('PUT VarBit TO Disk BY (100000)(X,SKIP),F(5);');
    assert.deepEqual(result.map(d => d.code), [mismatch]);
});

test('repeated inner control factors are fast-forwarded before a data format', () => {
    const result = diagnostics('PUT VarBit TO Disk BY (50000)((2)X,SKIP),F(5);');
    assert.deepEqual(result.map(d => d.code), [mismatch]);
});

test('repeated same-type mismatches at the same format are reported only once', () => {
    const result = diagnostics('PUT VarBit,VarBit,VarBit TO Disk BY F(5);');
    assert.deepEqual(result.map(d => d.code), [mismatch, repeated]);
});

test('different incompatible data types at the same format remain distinguishable', () => {
    const result = diagnostics('PUT VarBit,VarChar20 TO Disk BY F(5);');
    assert.deepEqual(result.map(d => d.code), [mismatch, repeated, mismatch]);
    assert.match(result[0].message, /VarBit/);
    assert.match(result[2].message, /VarChar20/);
});


test('superfluous conversion formats produce exactly one warning at the unused format', () => {
    const result = diagnostics('PUT A TO Disk BY F(5),E(10,3),B,LIST;');
    assert.deepEqual(result.map(d => d.code), [excess]);
    assert.equal(result[0].severity, SemanticDiagnosticSeverity.Warning);
    assert.match(result[0].message, /keine Datenobjekte/);
});

test('trailing position formats do not trigger surplus warnings', () => {
    assert.deepEqual(diagnostics('PUT A TO Disk BY F(5),X(3),SKIP;'), []);
    assert.deepEqual(diagnostics('PUT A TO Disk BY F(5),(3)X,SKIP;'), []);
    assert.deepEqual(diagnostics('PUT A TO Disk BY F(5),SKIP,B;').map(d => d.code), [excess]);
});

test('named FORMAT excess is warned at the actual unused conversion', () => {
    const results = diagnostics('PUT A TO Disk BY R(Ftab);', '',
        'Ftab: FORMAT (F(5),SKIP,E(8,2));');
    assert.deepEqual(results.map(d => d.code), [excess]);
});

test('unknown repetition counts do not produce speculative surplus warnings', () => {
    assert.deepEqual(diagnostics('PUT A TO Disk BY (FixedErr1)F(5),B;'), []);
});
