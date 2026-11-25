// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildIncludeContextUiState } from '../includeContextUiState';
import type { IncludeContextOption } from '../../utility/documentRegistry';

const uri = 'file:///test/shared.INC';
const unitUri = 'file:///test/PROG.P';
const a: IncludeContextOption = {
  unitUri, occurrence: { id: 'first', sourceUri: uri, sites: [], expandedSpan: { start: 0, end: 5 } }
};
const b: IncludeContextOption = {
  unitUri, occurrence: { id: 'second', sourceUri: uri, sites: [], expandedSpan: { start: 5, end: 10 } }
};
const build = (options: IncludeContextOption[], selection?: IncludeContextOption) =>
  buildIncludeContextUiState(uri, 9, false, options, selection, () => 'PROG.P',
    option => option.occurrence?.id ?? 'legacy');

test('two identical parent units remain distinct options by stable occurrence identity', () => {
  const result = build([a, b], b);
  assert.equal(result.selectedIndex, 1);
  assert.deepEqual(result.options.map(o => o.occurrenceId), ['first', 'second']);
  assert.equal(result.options[0]?.unitUri, result.options[1]?.unitUri);
  assert.equal(result.version, 9);
  assert.equal(result.knownIncluded, true);
});

test('no arbitrary first selection when the registry reports ambiguity', () => {
  assert.equal(build([a, b]).selectedIndex, null);
});

test('expired selection is not reinterpreted as a different occurrence', () => {
  const expired: IncludeContextOption = {
    unitUri, occurrence: { ...a.occurrence!, id: 'expired' }
  };
  assert.equal(build([a, b], expired).selectedIndex, null);
});

test('legacy occurrence without an id maps to null while remaining selectable', () => {
  const legacy = { unitUri };
  const result = build([legacy], legacy);
  assert.equal(result.selectedIndex, 0);
  assert.equal(result.options[0]?.occurrenceId, null);
});

test('unincluded .P file has zero options and is not marked included', () => {
  const result = build([], undefined);
  assert.deepEqual(result.options, []);
  assert.equal(result.knownIncluded, false);
});
