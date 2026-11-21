// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { IncludeDependencyWatcher, type IncludeFileChangeType } from '../includeDependencyWatcher';

function fixture(shouldWatch?: (uri: string) => boolean) {
  const subscriptions = new Map<string, (uri: string, type: IncludeFileChangeType) => void>();
  const creations: string[] = [];
  const disposals: string[] = [];
  const changes: { uri: string; type: IncludeFileChangeType }[] = [];
  const manager = new IncludeDependencyWatcher((directory, callback) => {
    assert.equal(subscriptions.has(directory), false, 'one watcher per directory');
    subscriptions.set(directory, callback);
    creations.push(directory);
    return { dispose() { subscriptions.delete(directory); disposals.push(directory); } };
  }, (uri, type) => { changes.push({ uri, type }); }, shouldWatch);
  return { manager, subscriptions, creations, disposals, changes,
    fire(directory: string, uri: string, type: IncludeFileChangeType) {
      const callback = subscriptions.get(directory);
      assert.ok(callback, `missing watcher for ${directory}`);
      callback(uri, type);
    }
  };
}

const uri = (name: string) => pathToFileURL(name).toString();

test('watches external libraries of arbitrary extensions without recursive scans', () => {
  const f = fixture();
  const first = uri('/libraries/H0/lib1.inc');
  const second = uri('/libraries/H0/other.def');
  const nested = uri('/libraries/H0/nested/var.xyz');
  f.manager.update({ revision: 1, uris: [first, second, nested, first] });
  assert.deepEqual(f.creations.sort(), ['/libraries/H0', '/libraries/H0/nested']);
  f.fire('/libraries/H0', first, 2);
  f.fire('/libraries/H0', second, 1);
  f.fire('/libraries/H0/nested', nested, 3);
  assert.deepEqual(f.changes, [
    { uri: first, type: 2 }, { uri: second, type: 1 }, { uri: nested, type: 3 }
  ]);
  f.manager.dispose();
  assert.equal(f.subscriptions.size, 0);
});

test('filters unrelated events even in a watched directory', () => {
  const f = fixture();
  const included = uri('/library/shared.h');
  f.manager.update({ revision: 1, uris: [included] });
  f.fire('/library', uri('/library/unrelated.h'), 2);
  assert.deepEqual(f.changes, []);
});

test('reconciles changed #ifdef paths without leaking watchers', () => {
  const f = fixture();
  const a = uri('/first/a.h');
  const b = uri('/second/b.inc');
  f.manager.update({ revision: 1, uris: [a] });
  f.manager.update({ revision: 2, uris: [b] });
  assert.deepEqual(f.disposals, ['/first']);
  assert.deepEqual([...f.subscriptions.keys()], ['/second']);
  f.fire('/second', b, 2);
  assert.deepEqual(f.changes, [{ uri: b, type: 2 }]);
});

test('ignores stale snapshots which race with server notifications', () => {
  const f = fixture();
  const a = uri('/lib/a.h');
  const b = uri('/lib/b.h');
  f.manager.update({ revision: 4, uris: [a] });
  f.manager.update({ revision: 3, uris: [b] });
  f.fire('/lib', b, 2);
  f.fire('/lib', a, 2);
  assert.deepEqual(f.changes, [{ uri: a, type: 2 }]);
});

test('keeps a missing file watched through deletion and recreation', () => {
  const f = fixture();
  const missing = uri('/library/removed.any');
  f.manager.update({ revision: 1, uris: [missing] });
  f.fire('/library', missing, 3);
  // The next compiler analysis still records the attempted #include path.
  f.manager.update({ revision: 2, uris: [missing] });
  f.fire('/library', missing, 1);
  assert.deepEqual(f.changes, [{ uri: missing, type: 3 }, { uri: missing, type: 1 }]);
  assert.equal(f.creations.length, 1);
});

test('workspace watchers may handle known internal suffixes independently', () => {
  const external = uri('/libraries/shared.h');
  const internalHeader = uri('/project/include/common.h');
  const internalUnusual = uri('/project/include/common.def');
  const f = fixture(value => value !== internalHeader);
  f.manager.update({ revision: 1, uris: [internalHeader, internalUnusual, external] });
  assert.deepEqual(f.creations.sort(), ['/libraries', '/project/include']);
  f.fire('/project/include', internalHeader, 2);
  f.fire('/project/include', internalUnusual, 2);
  assert.deepEqual(f.changes, [{ uri: internalUnusual, type: 2 }]);
});

test('does not register watcher for unsupported URI schemes', () => {
  const f = fixture();
  f.manager.update({ revision: 1, uris: ['untitled:hello', 'pearl-context:///file'] });
  assert.deepEqual(f.creations, []);
});

test('reinitializes subscriptions after a language-server restart', () => {
  const f = fixture();
  const a = uri('/first/a.inc');
  const b = uri('/second/b.inc');
  f.manager.update({ sessionId: 'server-1', revision: 17, uris: [a] });
  f.manager.update({ sessionId: 'server-2', revision: 0, uris: [b] });
  assert.deepEqual([...f.subscriptions.keys()], ['/second']);
  assert.deepEqual(f.disposals, ['/first']);
});
