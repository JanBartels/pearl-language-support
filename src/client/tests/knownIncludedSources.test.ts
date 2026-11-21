// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { KnownIncludedSources } from '../knownIncludedSources';

const main = 'file:///project/Main.P';
const lib = 'file:///external/H0/nested/types.def';
const missing = 'file:///external/H0/removed.inc';

test('accepts only successfully executed includes for direct-open language classification', () => {
  const sources = new KnownIncludedSources();
  assert.equal(sources.update({ sessionId: 'a', revision: 1, uris: [lib, missing],
    includedUris: [lib] }), true);
  assert.equal(sources.includes(lib), true);
  assert.equal(sources.includes(missing), false, 'a missing include is watch-only');
  assert.equal(sources.includes(main), false);
});

test('keeps arbitrary include suffixes and paths outside the workspace', () => {
  const sources = new KnownIncludedSources();
  const uris = [lib, 'file:///outside/header', 'file:///workspace/types.h',
    'file:///workspace/other.xyz'];
  sources.update({ revision: 1, uris, includedUris: uris });
  for (const uri of uris) assert.equal(sources.includes(uri), true);
});

test('updates membership after an include graph change', () => {
  const sources = new KnownIncludedSources();
  const newer = 'file:///external/H0/nested/types2.def';
  sources.update({ sessionId: 'a', revision: 1, uris: [lib], includedUris: [lib] });
  sources.update({ sessionId: 'a', revision: 2, uris: [newer], includedUris: [newer] });
  assert.equal(sources.includes(lib), false);
  assert.equal(sources.includes(newer), true);
});

test('publishes new membership when watch paths stay unchanged (file restored)', () => {
  const sources = new KnownIncludedSources();
  sources.update({ sessionId: 'a', revision: 1, uris: [missing], includedUris: [] });
  assert.equal(sources.includes(missing), false);
  sources.update({ sessionId: 'a', revision: 2, uris: [missing], includedUris: [missing] });
  assert.equal(sources.includes(missing), true);
});

test('rejects stale revisions and accepts a new server session', () => {
  const sources = new KnownIncludedSources();
  sources.update({ sessionId: 'a', revision: 5, uris: [lib], includedUris: [lib] });
  assert.equal(sources.update({ sessionId: 'a', revision: 4,
    uris: [missing], includedUris: [missing] }), false);
  assert.equal(sources.includes(lib), true);
  assert.equal(sources.includes(missing), false);
  assert.equal(sources.update({ sessionId: 'b', revision: 0,
    uris: [missing], includedUris: [] }), true);
  assert.equal(sources.includes(lib), false);
});

test('does not classify unknown URI schemes or accept malformed snapshots', () => {
  const sources = new KnownIncludedSources();
  sources.update({ revision: 1, uris: [], includedUris: ['untitled:untitled-1', lib] });
  assert.equal(sources.includes('untitled:untitled-1'), false);
  assert.equal(sources.includes(lib), true);
  assert.equal(sources.update({ revision: 2, uris: [missing] }), false);
  assert.equal(sources.includes(lib), true);
});
