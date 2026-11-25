// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import * as fs from 'node:fs';
import * as path from 'node:path';
import { filePathFromUri, isFileUri, uriFromFilePath } from './uriUtils';

/**
 * Root-relative search depth: 0 searches only files in the workspace folder,
 * 1 includes its immediate subdirectories, and so on.
 */
export interface TranslationUnitDiscoveryFolder {
    readonly path: string;
    readonly depth: number;
}

/**
 * Filesystem-only discovery of complete .P translation units.
 *
 * The index does not interpret PEARL, inspect includes, or own analyses.
 * Directory symlinks are not traversed. An explicitly opened .P file remains
 * eligible for analysis even when it lies below the configured search depth.
 */
export class FolderTranslationUnitIndex {
    private folders: readonly string[] = [];
    private readonly roots = new Set<string>();

    /**
     * Establish folder membership before asynchronous folder settings arrive.
     * This prevents an included source opened during startup from becoming an
     * independent root simply because discovery is still pending.
     */
    setFolders(folderPaths: readonly string[]): void {
        this.folders = [...new Set(folderPaths.map(folder => path.resolve(folder)))];
    }

    /** Reconcile the known roots with the bounded filesystem search. */
    refresh(folders: readonly TranslationUnitDiscoveryFolder[]): { added: string[]; removed: string[] } {
        this.setFolders(folders.map(folder => folder.path));
        const discovered = new Set<string>();

        for (const folder of folders) {
            const root = path.resolve(folder.path);
            const maximumDepth = folder.depth;
            if (!Number.isSafeInteger(maximumDepth) || maximumDepth < 0) {
                throw new RangeError(`Invalid translation unit discovery depth: ${maximumDepth}`);
            }

            // Iterative traversal avoids call-stack growth in deep projects.
            const pending: { directory: string; depth: number }[] = [{ directory: root, depth: 0 }];
            while (pending.length > 0) {
                const current = pending.pop()!;
                let entries: fs.Dirent[];
                try {
                    entries = fs.readdirSync(current.directory, { withFileTypes: true });
                } catch {
                    // An inaccessible/deleted subtree contributes no roots.
                    continue;
                }
                for (const entry of entries) {
                    const candidate = path.join(current.directory, entry.name);
                    if (entry.isFile() && isPearlTranslationUnitFilename(entry.name)) {
                        discovered.add(uriFromFilePath(candidate));
                    } else if (entry.isDirectory() && current.depth < maximumDepth) {
                        // Dirent.isDirectory() is false for a symlink: never follow it.
                        pending.push({ directory: candidate, depth: current.depth + 1 });
                    }
                }
            }
        }

        const added = [...discovered].filter(uri => !this.roots.has(uri)).sort();
        const removed = [...this.roots].filter(uri => !discovered.has(uri)).sort();
        this.roots.clear();
        for (const uri of discovered) this.roots.add(uri);
        return { added, removed };
    }

    hasRoot(uri: string): boolean {
        return this.roots.has(uri);
    }

    /** Folder membership is independent of the configured discovery depth. */
    isFolderSource(uri: string): boolean {
        if (!isFileUri(uri)) return false;
        const filePath = path.resolve(filePathFromUri(uri));
        return this.folders.some(folder => {
            const relative = path.relative(folder, filePath);
            return relative !== '' && relative !== '..'
                && !relative.startsWith(`..${path.sep}`)
                && !path.isAbsolute(relative);
        });
    }

    /** Explicitly opened .P files can be roots below the scan depth. */
    shouldAnalyzeAsRoot(uri: string): boolean {
        return !this.isFolderSource(uri)
            || isPearlTranslationUnitFilename(filePathFromUri(uri));
    }
}

export function isPearlTranslationUnitFilename(filename: string): boolean {
    return /\.p$/i.test(filename);
}
