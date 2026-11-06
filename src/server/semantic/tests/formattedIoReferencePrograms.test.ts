// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { analyzeFormattedIoSource } from '../../validation/tests/formattedIoTestFixture';

const files = ['00_GET_PUT.P', '01_FORMAT_R.P', '02_CONVERT.P', '03_WIEDERHOLUNG.P'];

for (const file of files) {
    test(`RTOS-UH formatted-I/O compiler reference fixture: ${file}`, () => {
        const text = readFileSync(join(__dirname, 'fixtures', 'formattedIo', file), 'utf8');
        const result = analyzeFormattedIoSource(text, `file:///reference-${file}`);
        assert.deepEqual(result.syntax, []);
        // The fixture sources omit target-specific P=/SC= compiler controls.
        const actualErrors = result.diagnostics.filter(diagnostic => diagnostic.severity === SemanticDiagnosticSeverity.Error);
        assert.deepEqual(actualErrors, []);
        assert.ok(result.statements.length > 0);
    });
}
