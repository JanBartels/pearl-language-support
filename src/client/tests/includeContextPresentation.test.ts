// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  IncludeContextRequestGate, includeContextQuickPickItems, presentIncludeContextStatus
} from '../includeContextPresentation';
import type { IncludeContextUiState } from '../../shared/includeContextUiProtocol';

const uri = 'file:///proj/with%20spaces/shared.INC';
const options = Array.from({ length: 19 }, (_, i) => ({
  unitUri: `file:///proj/PROG${i + 1}.P`,
  unitName: `PROG${i + 1}.P`,
  occurrenceId: `site-${i + 1}`,
  label: `PROG${i + 1}.P:${i + 10} → shared.INC:2`
}));
function state(selectedIndex: number | null, knownIncluded = true): IncludeContextUiState {
  return { uri, version: 4, knownIncluded, selectedIndex, options };
}

test('19 contexts are presented as one compact status with current context and ordinal', () => {
  const status = presentIncludeContextStatus(state(2));
  assert.equal(status?.text, '$(layers) PROG3.P (3/19)');
  assert.match(status?.tooltip ?? '', /PROG3\.P:12/);
  assert.equal(status?.canChoose, true);
});

test('ambiguous context is not silently selected', () => {
  const status = presentIncludeContextStatus(state(null));
  assert.equal(status?.text, '$(layers) PEARL: Kontext wählen (19)');
  assert.equal(status?.canChoose, true);
});

test('picker preserves all occurrences and highlights the selected one', () => {
  const entries = includeContextQuickPickItems(state(12));
  assert.equal(entries.length, 19);
  assert.equal(entries.filter(e => e.picked).length, 1);
  assert.equal(entries[12]?.label, '$(check) 13. PROG13.P');
  assert.equal(entries[12]?.optionIndex, 12);
  assert.match(entries[12]?.description ?? '', /PROG13\.P/);
});

test('a single included context is shown without offering a redundant picker', () => {
  const s: IncludeContextUiState = { ...state(0), options: [options[0]!] };
  const status = presentIncludeContextStatus(s);
  assert.equal(status?.text, '$(layers) PROG1.P (1/1)');
  assert.equal(status?.canChoose, false);
});

test('unavailable analysis leaves a visible, non-interactive pending state', () => {
  const pending: IncludeContextUiState = { ...state(null), options: [] };
  assert.match(presentIncludeContextStatus(pending)?.text ?? '', /wird analysiert/);
  assert.equal(presentIncludeContextStatus(pending)?.canChoose, false);
});

test('normal .P files do not get an Include status bar entry', () => {
  const plain: IncludeContextUiState = {
    ...state(null, false), options: []
  };
  assert.equal(presentIncludeContextStatus(plain), null);
});

test('stale indexed selection is not rendered as valid', () => {
  const invalid: IncludeContextUiState = { ...state(99), options: options.slice(0, 2) };
  assert.equal(presentIncludeContextStatus(invalid)?.text,
    '$(layers) PEARL: Kontext wählen (2)');
});

test('late async response from previous editor is ignored', async () => {
  const gate = new IncludeContextRequestGate();
  let resolve!: (s: IncludeContextUiState | null) => void;
  const first = gate.read(uri, () => new Promise(done => { resolve = done; }));
  const secondUri = 'file:///proj/other.INC';
  const second = await gate.read(secondUri, async () => ({ ...state(2), uri: secondUri }));
  resolve(state(1));
  assert.equal((await first), null);
  assert.equal(second?.uri, secondUri);
});

test('late response after cancelling for an empty editor is ignored', async () => {
  const gate = new IncludeContextRequestGate();
  let resolve!: (s: IncludeContextUiState | null) => void;
  const first = gate.read(uri, () => new Promise(done => { resolve = done; }));
  gate.cancel();
  resolve(state(5));
  assert.equal(await first, null);
});

test('mismatched response URI is discarded', async () => {
  const gate = new IncludeContextRequestGate();
  assert.equal(await gate.read(uri, async () => ({ ...state(0), uri: 'file:///other' })), null);
});
