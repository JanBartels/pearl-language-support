// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { analyzeFormattedIoSource } from '../../validation/tests/formattedIoTestFixture';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';

const header = 'P=MPC603; SC=2000; MODULE M; SYSTEM; PROBLEM;';

test('RTOS-UH: local array INIT with three values is excessive, module-level INIT is not', () => {
    const local = analyzeFormattedIoSource(`${header}
        Test: TASK MAIN;
            DCL Feld(1:3) FIXED(15) INIT(11,22,33);
        END; MODEND;`);
    assert.deepEqual(local.syntax, []);
    assert.deepEqual(local.diagnostics.map(d => d.code),
        [SemanticDiagnosticCode.InitializationElementCount]);

    const global = analyzeFormattedIoSource(`${header}
        DCL Feld(1:3) FIXED(15) INIT(11,22,33);
        Test: TASK MAIN; END; MODEND;`);
    assert.deepEqual(global.syntax, []);
    assert.deepEqual(global.diagnostics, []);
});
