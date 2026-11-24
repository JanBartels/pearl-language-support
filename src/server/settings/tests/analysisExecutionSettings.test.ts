// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveAnalysisExecutionSettings } from '../analysisExecutionSettings';

const noEnvironment = {};

for (const workers of [0, 1, 2, 4, 8, 16]) {
  test(`initialization setting ${workers} selects ${workers === 0 ? 'local' : 'worker'} execution`, () => {
    assert.deepEqual(resolveAnalysisExecutionSettings(
      { analysis: { workerCount: workers } }, noEnvironment
    ), { workerCount: workers, source: 'settings' });
  });
}

test('older LSP clients and missing settings preserve the local default', () => {
  assert.deepEqual(resolveAnalysisExecutionSettings(undefined, noEnvironment),
    { workerCount: 0, source: 'settings' });
  assert.deepEqual(resolveAnalysisExecutionSettings({}, noEnvironment),
    { workerCount: 0, source: 'settings' });
  assert.deepEqual(resolveAnalysisExecutionSettings({ analysis: {} }, noEnvironment),
    { workerCount: 0, source: 'settings' });
});

test('non-integer, negative, excessive and malformed settings fail without silent clamping', () => {
  for (const workerCount of [-1, 17, 4.5, '8', NaN, null, Infinity]) {
    assert.throws(() => resolveAnalysisExecutionSettings(
      { analysis: { workerCount } }, noEnvironment
    ), /pearl\.analysis\.workerCount/);
  }
});

test('existing Worker F5 environment overrides the regular window setting', () => {
  assert.deepEqual(resolveAnalysisExecutionSettings(
    { analysis: { workerCount: 0 } },
    { PEARL_ANALYSIS_EXECUTOR: 'worker', PEARL_ANALYSIS_WORKERS: '8' }
  ), { workerCount: 8, source: 'environment' });
  assert.deepEqual(resolveAnalysisExecutionSettings(
    { analysis: { workerCount: 8 } },
    { PEARL_ANALYSIS_EXECUTOR: 'worker' }
  ), { workerCount: 1, source: 'environment' });
});

test('explicit local environment override keeps a local executor', () => {
  assert.deepEqual(resolveAnalysisExecutionSettings(
    { analysis: { workerCount: 8 } },
    { PEARL_ANALYSIS_EXECUTOR: 'local', PEARL_ANALYSIS_WORKERS: '8' }
  ), { workerCount: 0, source: 'environment' });
});

test('invalid F5 worker count is rejected even if the VS Code setting is valid', () => {
  for (const count of ['0', '17', '2.5', 'nope', '']) {
    assert.throws(() => resolveAnalysisExecutionSettings(
      { analysis: { workerCount: 4 } },
      { PEARL_ANALYSIS_EXECUTOR: 'worker', PEARL_ANALYSIS_WORKERS: count }
    ), /PEARL_ANALYSIS_WORKERS/);
  }
});

test('invalid environment mode is rejected instead of masking the configured setting', () => {
  assert.throws(() => resolveAnalysisExecutionSettings(
    { analysis: { workerCount: 4 } },
    { PEARL_ANALYSIS_EXECUTOR: 'workers' }
  ), /PEARL_ANALYSIS_EXECUTOR/);
});
