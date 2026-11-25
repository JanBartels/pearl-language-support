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
    try { run(folder); } finally { fs.rmSync(folder, { recursive: true, force: true }); }
}

function file(folder: string, name: string): string {
    const filename = path.join(folder, name);
    fs.writeFileSync(filename, 'MODULE; PROBLEM; MODEND;');
    return uriFromFilePath(filename);
}

const scope = (folder: string, depth = 0) => [{ path: folder, depth }];

test('default depth 0 discovers .P roots, not headers or nested .P files', () => {
    withTempFolder(folder => {
        const a = file(folder, 'Main.P');
        const b = file(folder, 'Second.p');
        const header = file(folder, 'Common.h');
        const subfolder = path.join(folder, 'nested');
        fs.mkdirSync(subfolder);
        const nested = file(subfolder, 'Nested.P');
        const index = new FolderTranslationUnitIndex();

        assert.deepEqual(index.refresh(scope(folder)), { added: [a, b].sort(), removed: [] });
        assert.equal(index.hasRoot(header), false);
        assert.equal(index.hasRoot(nested), false);
        assert.equal(index.isFolderSource(header), true);
        assert.equal(index.isFolderSource(nested), true);
        assert.equal(index.shouldAnalyzeAsRoot(header), false);
        assert.equal(index.shouldAnalyzeAsRoot(nested), true);
        assert.deepEqual(index.refresh(scope(folder)), { added: [], removed: [] });
    });
});

test('depth counts directory levels relative to the workspace root', () => {
    withTempFolder(folder => {
        const a = file(folder, 'A.P');
        const one = path.join(folder, 'one');
        const two = path.join(one, 'two');
        const three = path.join(two, 'three');
        fs.mkdirSync(three, { recursive: true });
        const b = file(one, 'B.P');
        const c = file(two, 'C.p');
        const d = file(three, 'D.P');
        const index = new FolderTranslationUnitIndex();

        assert.deepEqual(index.refresh(scope(folder, 0)).added, [a]);
        assert.deepEqual(index.refresh(scope(folder, 1)), { added: [b], removed: [] });
        assert.deepEqual(index.refresh(scope(folder, 2)), { added: [c], removed: [] });
        assert.deepEqual(index.refresh(scope(folder, 3)), { added: [d], removed: [] });
        assert.deepEqual(index.refresh(scope(folder, 1)), { added: [], removed: [c, d].sort() });
        assert.equal(index.hasRoot(b), true);
        assert.equal(index.isFolderSource(d), true);
        assert.equal(index.shouldAnalyzeAsRoot(d), true);
    });
});

test('each workspace root can use a distinct discovery depth', () => {
    withTempFolder(folder => {
        const first = path.join(folder, 'first');
        const second = path.join(folder, 'second');
        fs.mkdirSync(path.join(first, 'nested'), { recursive: true });
        fs.mkdirSync(path.join(second, 'nested'), { recursive: true });
        const a = file(path.join(first, 'nested'), 'A.P');
        const b = file(path.join(second, 'nested'), 'B.P');
        const index = new FolderTranslationUnitIndex();

        assert.deepEqual(index.refresh([{ path: first, depth: 1 }, { path: second, depth: 0 }]).added, [a]);
        assert.equal(index.hasRoot(b), false);
        assert.deepEqual(index.refresh([{ path: first, depth: 0 }, { path: second, depth: 1 }]), {
            added: [b], removed: [a]
        });
    });
});

test('overlapping workspace roots do not duplicate discovered files', () => {
    withTempFolder(folder => {
        const subfolder = path.join(folder, 'sub');
        fs.mkdirSync(subfolder);
        const nested = file(subfolder, 'Nested.P');
        const index = new FolderTranslationUnitIndex();
        assert.deepEqual(index.refresh([
            { path: folder, depth: 1 }, { path: subfolder, depth: 0 }
        ]).added, [nested]);
        assert.deepEqual(index.refresh([
            { path: folder, depth: 0 }, { path: subfolder, depth: 0 }
        ]), { added: [], removed: [] });
    });
});

test('new and removed nested .P files are reconciled', () => {
    withTempFolder(folder => {
        const nested = path.join(folder, 'nested');
        fs.mkdirSync(nested);
        const first = file(nested, 'First.P');
        const index = new FolderTranslationUnitIndex();
        assert.deepEqual(index.refresh(scope(folder, 1)).added, [first]);

        fs.rmSync(path.join(nested, 'First.P'));
        const second = file(nested, 'Second.P');
        assert.deepEqual(index.refresh(scope(folder, 1)), { added: [second], removed: [first] });
        fs.rmSync(nested, { recursive: true });
        assert.deepEqual(index.refresh(scope(folder, 1)), { added: [], removed: [second] });
    });
});

test('directory symlinks are never traversed (including cycles)', () => {
    withTempFolder(folder => {
        const nested = path.join(folder, 'nested');
        fs.mkdirSync(nested);
        const real = file(nested, 'Real.P');
        try { fs.symlinkSync(folder, path.join(nested, 'back'), 'dir'); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EPERM') return;
            throw error;
        }
        const index = new FolderTranslationUnitIndex();
        assert.deepEqual(index.refresh(scope(folder, 10)).added, [real]);
    });
});

test('invalid discovery depths are rejected by the filesystem index', () => {
    withTempFolder(folder => {
        const index = new FolderTranslationUnitIndex();
        for (const depth of [-1, 1.5, NaN, Infinity]) {
            assert.throws(() => index.refresh(scope(folder, depth)), RangeError);
        }
    });
});

test('folder membership can be established before asynchronous depth lookup', () => {
    withTempFolder(folder => {
        const index = new FolderTranslationUnitIndex();
        const header = file(folder, 'common.inc');
        index.setFolders([folder]);
        assert.equal(index.shouldAnalyzeAsRoot(header), false);
        assert.equal(index.isFolderSource(uriFromFilePath(folder + '-other/common.inc')), false);
    });
});

test('switching from Open Folder to Open File clears discovered roots and ownership', () => {
    withTempFolder(folder => {
        const root = file(folder, 'Main.P');
        const header = file(folder, 'Common.h');
        const index = new FolderTranslationUnitIndex();
        index.refresh(scope(folder));
        assert.deepEqual(index.refresh([]), { added: [], removed: [root] });
        assert.equal(index.isFolderSource(header), false);
        assert.equal(index.shouldAnalyzeAsRoot(header), true);
    });
});

test('folder membership checks non-file URIs and path boundaries', () => {
    withTempFolder(folder => {
        const index = new FolderTranslationUnitIndex();
        index.refresh(scope(folder));
        assert.equal(index.isFolderSource(uriFromFilePath(path.join(folder, 'Include.h'))), true);
        assert.equal(index.isFolderSource(uriFromFilePath(folder + '-other/Include.h')), false);
        assert.equal(index.isFolderSource('untitled:Include.h'), false);
        assert.equal(index.shouldAnalyzeAsRoot('untitled:Include.h'), true);
    });
});

test('translation unit extension matching is case-insensitive', () => {
    assert.equal(isPearlTranslationUnitFilename('Some.P'), true);
    assert.equal(isPearlTranslationUnitFilename('some.p'), true);
    assert.equal(isPearlTranslationUnitFilename('Some.h'), false);
    assert.equal(isPearlTranslationUnitFilename('Some.P.bak'), false);
});
