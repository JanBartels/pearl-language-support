// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
import { analyzeFormattedIo } from '../../validation/tests/formattedIoTestFixture';

test('GET/PUT/CONVERT basic semantic validation accepts valid operands', () => {
    const result = analyzeFormattedIo(`
        GET VarFixed31, VarBit FROM Disk BY SKIP,RST(FixedErr1),F(3),X,B;
        PUT VarChar20 TO Disk BY A(LEN(VarChar20)),SKIP;
        CONVERT A, B FROM VarChar20 BY RST(FixedErr1),F(4),E(10,2);
        CONVERT 'Index =', A TO VarChar20 BY A,F(4);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
});

test('RST accepts writable FIXED with default, 15-bit and 31-bit precision', () => {
    const result = analyzeFormattedIo(`
        GET A FROM Disk BY RST(FixedErr1), F(5);
        PUT A TO Disk BY RST(Error31), F(5);
        CONVERT A TO VarChar20 BY RST(A), F(5);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
});

test('RST rejects INV FIXED at either precision and non-FIXED targets', () => {
    const result = analyzeFormattedIo(`
        PUT A TO Disk BY RST(InvErr), F(5);
        PUT A TO Disk BY RST(BadErr), F(5);
        PUT A TO Disk BY RST(InvError31), F(5);
    `, 'DCL InvError31 INV FIXED(31) INIT(0);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [
        SemanticDiagnosticCode.InvalidFormatReportVariable,
        SemanticDiagnosticCode.InvalidFormatReportVariable,
        SemanticDiagnosticCode.InvalidFormatReportVariable
    ]);
});


test('format argument widths are deferred; data/format mismatches are now diagnosed', () => {
    const result = analyzeFormattedIo('PUT A, B TO Disk BY F(1),SKIP,B(100),X(2);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics.map(d => d.code),
        [SemanticDiagnosticCode.IncompatibleFormattedIoFormat]);
});

test('R refers to a FORMAT declaration even when declaration follows the use', () => {
    const result = analyzeFormattedIo('PUT A TO Disk BY R(Later);', '', 'Later: FORMAT (F(3));');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const name = result.statements[0].formats!.items[0].reference!.identifier;
    assert.equal(result.semantic.bindings.get(name)?.name, result.declarations[0].name);
});

test('local R reference resolves its local FORMAT declaration', () => {
    const result = analyzeFormattedIo('Local: FORMAT (F(3)); PUT A TO Disk BY R(Local);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.semantic.bindings.get(result.statements[0].formats!.items[0].reference!.identifier)?.name,
        result.declarations[0].name);
});

test('unresolved R reference yields a diagnostic, next GET is retained', () => {
    const result = analyzeFormattedIo('PUT A TO Disk BY R(Unknown); GET A FROM Disk BY F(3);');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements.length, 2);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code),
        [SemanticDiagnosticCode.InvalidFormatReference]);
});

test('invalid DATION direction/class and CONVERT CHARACTER targets are diagnosed', () => {
    const result = analyzeFormattedIo(`
        GET A FROM DiskOut; PUT A TO DiskIn; PUT A TO Basic;
        CONVERT A FROM A BY F(3); CONVERT A TO A BY F(3);`,
        `DCL DiskIn DATION IN ALPHIC CREATED(Disk);
         DCL DiskOut DATION OUT ALPHIC CREATED(Disk);
         DCL Basic DATION INOUT BASIC CREATED(Disk);`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.diagnostics.some(diagnostic =>
        diagnostic.code === SemanticDiagnosticCode.InvalidFormattedIoDirection));
    assert.ok(result.diagnostics.some(diagnostic =>
        diagnostic.code === SemanticDiagnosticCode.InvalidFormattedIoDation));
    assert.ok(result.diagnostics.some(diagnostic =>
        diagnostic.code === SemanticDiagnosticCode.InvalidFormattedIoTarget));
});

test('GET uses shared array segment type and bounds diagnostics', () => {
    const result = analyzeFormattedIo(`
        GET VarFixed31(1:2) FROM Disk BY F(4);
        GET Array(1:4) FROM Disk BY F(4);
        GET Array(3:2) FROM Disk BY F(4);
        GET Array(BadErr:3) FROM Disk BY F(4);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [
        SemanticDiagnosticCode.InvalidIoSegment,
        SemanticDiagnosticCode.InvalidIoSegment,
        SemanticDiagnosticCode.InvalidIoSegment,
        SemanticDiagnosticCode.InvalidIoSegment
    ]);
});
