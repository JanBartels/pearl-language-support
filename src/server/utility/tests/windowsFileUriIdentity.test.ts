// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fileUriForLsp } from '../uriUtils';

test('Windows drive URI matches VS Code document serialization', () => {
  assert.equal(
    fileUriForLsp('file:///C:/Projekte/SPC/INIFILE.H', 'win32'),
    'file:///c%3A/Projekte/SPC/INIFILE.H'
  );
});

test('Lowercase Windows drive is encoded consistently', () => {
  assert.equal(
    fileUriForLsp('file:///c:/Projekte/SPC/INIFILE.H', 'win32'),
    'file:///c%3A/Projekte/SPC/INIFILE.H'
  );
});

test('Windows file URI is reversible to the same physical path', () => {
  const projected = fileUriForLsp('file:///C:/Projekte/SPC/INIFILE.H', 'win32');
  assert.equal(fileURLToPath(projected, { windows: true }),
    'c:\\Projekte\\SPC\\INIFILE.H');
});

test('Relative include can leave workspace without changing URI identity', () => {
  const root = 'C:\\Projekt\\Source\\PROG1.P';
  const resolved = path.win32.resolve(path.win32.dirname(root), '../Shared/TYPES.H');
  assert.equal(resolved, 'C:\\Projekt\\Shared\\TYPES.H');
  const projected = fileUriForLsp(pathToFileURL(resolved, { windows: true }).href, 'win32');
  assert.equal(projected, 'file:///c%3A/Projekt/Shared/TYPES.H');
});

test('Windows UNC shares are not rewritten as drive URIs', () => {
  const original = 'file://server/share/Includes/Types.H';
  assert.equal(fileUriForLsp(original, 'win32'), original);
});

test('POSIX paths keep their original URI on all platforms', () => {
  const original = 'file:///home/jan/libraries/Types.H';
  assert.equal(fileUriForLsp(original, 'linux'), original);
  assert.equal(fileUriForLsp(original, 'win32'), original);
});

test('URI escapes and case-sensitive path segments remain unchanged', () => {
  const original = 'file:///C:/Projekt/Foo%20Bar/Typ%C3%BC.H';
  assert.equal(fileUriForLsp(original, 'win32'),
    'file:///c%3A/Projekt/Foo%20Bar/Typ%C3%BC.H');
});
