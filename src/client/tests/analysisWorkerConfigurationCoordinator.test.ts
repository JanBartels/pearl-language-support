// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AnalysisWorkerConfigurationCoordinator } from '../analysisWorkerConfigurationCoordinator';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test('forwards a setting notification completely before restarting the language server', async () => {
  const events: string[] = [];
  let count = 4;
  const sent = deferred();
  const coordinator = new AnalysisWorkerConfigurationCoordinator(
    () => count,
    async () => { events.push('restart'); coordinator.noteInitialization(count); }
  );
  coordinator.noteInitialization(4);
  count = 8;
  const completed = coordinator.forwardConfiguration(['pearl'], async () => {
    events.push('forward');
    await sent.promise;
    events.push('delivered');
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ['forward']);
  sent.resolve();
  await completed;
  assert.deepEqual(events, ['forward', 'delivered', 'restart']);
});

test('ordinary PEARL setting changes are forwarded without restarting', async () => {
  let count = 8;
  let forwards = 0;
  let restarts = 0;
  const coordinator = new AnalysisWorkerConfigurationCoordinator(
    () => count, async () => { restarts++; }
  );
  coordinator.noteInitialization(8);
  await coordinator.forwardConfiguration(['pearl'], async () => { forwards++; });
  count = 8;
  await coordinator.forwardConfiguration(['pearl'], async () => { forwards++; });
  assert.equal(forwards, 2);
  assert.equal(restarts, 0);
});

test('rapid change notifications are serialized across the restart', async () => {
  let count = 4;
  const restartGate = deferred();
  const events: string[] = [];
  const coordinator = new AnalysisWorkerConfigurationCoordinator(
    () => count,
    async () => {
      events.push('restart-start');
      await restartGate.promise;
      coordinator.noteInitialization(count);
      events.push('restart-end');
    }
  );
  coordinator.noteInitialization(4);
  count = 8;
  const first = coordinator.forwardConfiguration(['pearl'], async () => {
    events.push('forward-first');
  });
  const second = coordinator.forwardConfiguration(['pearl'], async () => {
    events.push('forward-second');
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ['forward-first', 'restart-start']);
  restartGate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(events, [
    'forward-first', 'restart-start', 'restart-end', 'forward-second'
  ]);
});

test('a failed notification must not stop the server; subsequent delivery can retry', async () => {
  let count = 4;
  let restarts = 0;
  const coordinator = new AnalysisWorkerConfigurationCoordinator(
    () => count,
    async () => { restarts++; coordinator.noteInitialization(count); }
  );
  coordinator.noteInitialization(0);
  await assert.rejects(coordinator.forwardConfiguration(['pearl'], async () => {
    throw new Error('transport error');
  }), /transport error/);
  assert.equal(restarts, 0);
  await coordinator.forwardConfiguration(['pearl'], async () => {});
  assert.equal(restarts, 1);
});

test('initial config synchronization does not restart; no restart before initialization', async () => {
  let restarts = 0;
  const coordinator = new AnalysisWorkerConfigurationCoordinator(
    () => 8, async () => { restarts++; }
  );
  await coordinator.forwardConfiguration(['pearl'], async () => {});
  coordinator.noteInitialization(8);
  await coordinator.forwardConfiguration(['pearl'], async () => {});
  assert.equal(restarts, 0);
});
