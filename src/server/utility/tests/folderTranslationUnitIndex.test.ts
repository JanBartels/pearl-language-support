// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FolderTranslationUnitIndex, isPearlTranslationUnitFilename } from '../folderTranslationUnitIndex';
import { uriFromFilePath } from '../uriUtils';

function withTempFolder(run: (folder: string) => void): void {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-folder-index-'));
    try {
        run(folder);
    } finally {
        fs.rmSync(folder, { recursive: true, force: true });
    }
}

function file(folder: string, name: string): string {
    const filename = path.join(folder, name);
    fs.writeFileSync(filename, 'MODULE; PROBLEM; MODEND;');
    return uriFromFilePath(filename);
}

test('Open Folder finds complete .P units but never treats .h files as roots', () => {
    withTempFolder(folder => {
        const a = file(folder, 'Main.P');
        const b = file(folder, 'Second.p');
        const header = file(folder, 'Common.h');
        const index = new FolderTranslationUnitIndex();

        assert.deepEqual(index.refresh([folder]), { added: [a, b].sort(), removed: [] });
        assert.equal(index.hasRoot(a), true);
        assert.equal(index.hasRoot(b), true);
        assert.equal(index.hasRoot(header), false);
        assert.equal(index.isFolderSource(header), true);
        assert.equal(index.shouldAnalyzeAsRoot(header), false);
        assert.equal(index.shouldAnalyzeAsRoot(a), true);
        assert.deepEqual(index.refresh([folder]), { added: [], removed: [] });
    });
});

test('folder discovery is intentionally non-recursive', () => {
    withTempFolder(folder => {
        const root = file(folder, 'Root.P');
        const subfolder = path.join(folder, 'nested');
        fs.mkdirSync(subfolder);
        const nested = file(subfolder, 'Nested.P');
        const index = new FolderTranslationUnitIndex();

        assert.deepEqual(index.refresh([folder]).added, [root]);
        assert.equal(index.hasRoot(nested), false);
        assert.equal(index.isFolderSource(nested), true);
        assert.equal(index.shouldAnalyzeAsRoot(nested), true);
    });
});

test('new and removed .P files are reconciled without stale roots', () => {
    withTempFolder(folder => {
        const first = file(folder, 'First.P');
        const index = new FolderTranslationUnitIndex();
        assert.deepEqual(index.refresh([folder]).added, [first]);

        fs.rmSync(path.join(folder, 'First.P'));
        const second = file(folder, 'Second.P');
        assert.deepEqual(index.refresh([folder]), { added: [second], removed: [first] });
        assert.equal(index.hasRoot(first), false);
        assert.equal(index.hasRoot(second), true);
    });
});

test('switching from Open Folder to Open File clears folder ownership', () => {
    withTempFolder(folder => {
        const root = file(folder, 'Main.P');
        const header = file(folder, 'Common.h');
        const index = new FolderTranslationUnitIndex();
        index.refresh([folder]);
        assert.deepEqual(index.refresh([]), { added: [], removed: [root] });
        assert.equal(index.isFolderSource(header), false);
        assert.equal(index.shouldAnalyzeAsRoot(header), true);
    });
});

test('folder membership uses path boundaries and ignores non-file URIs', () => {
    withTempFolder(folder => {
        const index = new FolderTranslationUnitIndex();
        index.refresh([folder]);
        assert.equal(index.isFolderSource(uriFromFilePath(path.join(folder, 'Include.h'))), true);
        assert.equal(index.isFolderSource(uriFromFilePath(folder + '-other/Include.h')), false);
        assert.equal(index.isFolderSource('untitled:Include.h'), false);
        assert.equal(index.shouldAnalyzeAsRoot('untitled:Include.h'), true);
    });
});

test('translation unit filename convention is case-insensitive', () => {
    assert.equal(isPearlTranslationUnitFilename('Some.P'), true);
    assert.equal(isPearlTranslationUnitFilename('some.p'), true);
    assert.equal(isPearlTranslationUnitFilename('Some.h'), false);
    assert.equal(isPearlTranslationUnitFilename('Some.P.bak'), false);
});
