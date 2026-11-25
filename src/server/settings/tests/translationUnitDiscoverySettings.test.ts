// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  defaultTranslationUnitDiscoveryDepth,
  normalizeTranslationUnitDiscoveryDepth
} from '../translationUnitDiscoverySettings';

test('depth 0 is backward-compatible default', () => {
  assert.equal(defaultTranslationUnitDiscoveryDepth, 0);
  for (const value of [undefined, null, '2', -1, 1.5, NaN, Infinity, {}, true]) {
    assert.equal(normalizeTranslationUnitDiscoveryDepth(value), 0);
  }
});

test('valid integer depths are retained', () => {
  for (const depth of [0, 1, 2, 8, 32, 100]) {
    assert.equal(normalizeTranslationUnitDiscoveryDepth(depth), depth);
  }
});

test('unsafe integers are not accepted', () => {
  assert.equal(normalizeTranslationUnitDiscoveryDepth(Number.MAX_SAFE_INTEGER + 1), 0);
});
