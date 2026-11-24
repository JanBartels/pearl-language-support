// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AnalysisSourceSnapshot } from './analysisSourceSnapshot';
import type { SnapshotSourceDocument } from './analysisSnapshotCollector';

/**
 * Proof of a single editor didOpen transition, not a general permission to
 * ignore document versions. Disk-backed includes usually have version 0;
 * opening the *same bytes* in VS Code assigns an editor version (often 1).
 *
 * An in-flight analysis may have captured the disk version before didOpen.
 * Keep its immutable input valid only while that exact opened document is
 * still current. Any subsequent content/version event, close, or filesystem
 * notification revokes the proof. Root versions are never rebased.
 *
 * This class owns neither the snapshot nor the accepted AnalysisResult.
 */
export class OpenSourceSnapshotVersionBridge {
    private readonly openings = new Map<string, {
        readonly version: number;
        readonly languageId: string;
        readonly text: string;
    }>();

    didOpen(document: SnapshotSourceDocument): void {
        this.openings.set(document.uri, {
            version: document.version,
            languageId: document.languageId,
            text: document.getText()
        });
    }

    /** TextDocuments emits didChangeContent immediately after didOpen. */
    didChangeContent(document: SnapshotSourceDocument): void {
        const opened = this.openings.get(document.uri);
        if (opened && (opened.version !== document.version
            || opened.languageId !== document.languageId
            || opened.text !== document.getText())) {
            this.openings.delete(document.uri);
        }
    }

    invalidate(uri: string): void {
        this.openings.delete(uri);
    }

    /**
     * The caller has already verified URI, language and exact current text.
     * Only a disk-version (0) -> editor-version transition caused by didOpen
     * is eligible. No acceptance for later edits or another editor version.
     */
    accepts(captured: AnalysisSourceSnapshot, current: SnapshotSourceDocument): boolean {
        const opened = this.openings.get(captured.uri);
        return captured.version === 0
            && !!opened
            && opened.version === current.version
            && opened.version !== captured.version
            && opened.languageId === captured.languageId
            && opened.languageId === current.languageId
            && opened.text === captured.text
            && opened.text === current.getText();
    }
}
