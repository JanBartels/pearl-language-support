// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Connection, InitializeParams } from 'vscode-languageserver/node';
import { SettingsManager } from '../settingsManager';

function createManager(getConfiguration: (section: string, scopeUri: string) => Promise<unknown>) {
  const requests: { section: string; scopeUri: string }[] = [];
  const connection = {
    workspace: {
      getConfiguration: ({ section, scopeUri }: { section: string; scopeUri: string }) => {
        requests.push({ section, scopeUri });
        return getConfiguration(section, scopeUri);
      }
    },
    client: { register: () => Promise.resolve() }
  };
  const manager = new SettingsManager(connection as unknown as Connection);
  manager.initialize({ capabilities: { workspace: { configuration: true } } } as InitializeParams);
  return { manager, requests };
}

test('discovery depth is resource scoped and independently cached for each folder', async () => {
  const { manager, requests } = createManager(async (_section, scopeUri) =>
    scopeUri.endsWith('/first') ? 1 : 3
  );
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project/first'), 1);
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project/second'), 3);
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project/first'), 1);
  assert.deepEqual(requests, [
    { section: 'pearl.translationUnits.discoveryDepth', scopeUri: 'file:///project/first' },
    { section: 'pearl.translationUnits.discoveryDepth', scopeUri: 'file:///project/second' }
  ]);
});

test('configuration notification invalidates cached discovery settings', async () => {
  let depth = 1;
  const { manager, requests } = createManager(async () => depth);
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project'), 1);
  depth = 2;
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project'), 1);
  manager.handleConfigurationChange({});
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project'), 2);
  assert.equal(requests.length, 2);
});

test('failed configuration lookup is retried on next refresh', async () => {
  let calls = 0;
  const { manager } = createManager(async () => {
    if (++calls === 1) throw new Error('temporary failure');
    return 2;
  });
  await assert.rejects(manager.getTranslationUnitDiscoveryDepth('file:///project'));
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project'), 2);
  assert.equal(calls, 2);
});

test('LSP clients without configuration capability default to depth 0', async () => {
  const { manager, requests } = createManager(async () => 12);
  manager.initialize({ capabilities: {} } as InitializeParams);
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project'), 0);
  manager.handleConfigurationChange({ pearl: { translationUnits: { discoveryDepth: 2 } } });
  assert.equal(await manager.getTranslationUnitDiscoveryDepth('file:///project'), 2);
  assert.deepEqual(requests, []);
});
