// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import * as fs from 'node:fs';
import * as path from 'node:path';
import { filePathFromUri, isFileUri, uriFromFilePath } from './uriUtils';

/**
 * Discovery of translation units for the simple "Open Folder" workflow.
 *
 * Only *.P files directly inside a configured folder are considered roots.
 * This index does not parse PEARL, inspect includes or own analysis results.
 * In particular, a header must not become a translation unit merely because
 * it is opened in an editor.
 */
export class FolderTranslationUnitIndex {
    private folders: readonly string[] = [];
    private readonly roots = new Set<string>();

    /** Reconcile the filesystem with the known folder roots. */
    refresh(folderPaths: readonly string[]): { added: string[]; removed: string[] } {
        this.folders = [...new Set(folderPaths.map(folder => path.resolve(folder)))];
        const discovered = new Set<string>();
        for (const folder of this.folders) {
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(folder, { withFileTypes: true });
            } catch {
                // An inaccessible or removed folder has no known roots.
                continue;
            }
            for (const entry of entries) {
                if (entry.isFile() && isPearlTranslationUnitFilename(entry.name)) {
                    discovered.add(uriFromFilePath(path.join(folder, entry.name)));
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

    /** A source in a folder, not necessarily a directly scanned root. */
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

    /** A .P file can be a root even if it was added after folder discovery. */
    shouldAnalyzeAsRoot(uri: string): boolean {
        return !this.isFolderSource(uri)
            || isPearlTranslationUnitFilename(filePathFromUri(uri));
    }
}

export function isPearlTranslationUnitFilename(filename: string): boolean {
    return /\.p$/i.test(filename);
}
