// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { IncludeWatchSnapshot } from './includeDependencyWatcher';

/**
 * Read-only source membership derived from accepted translation-unit analyses.
 * Language assignment is a VS Code client concern, not a compiler decision.
 * Watch-only targets (including missing files) are deliberately excluded.
 */
export class KnownIncludedSources {
  private sessionId: string | undefined;
  private revision = -1;
  private sources = new Set<string>();

  /** Returns true only when a new, valid server snapshot was accepted. */
  update(snapshot: IncludeWatchSnapshot): boolean {
    if (!snapshot || !Number.isInteger(snapshot.revision)
        || !Array.isArray(snapshot.includedUris)) return false;
    if (snapshot.sessionId === this.sessionId && snapshot.revision <= this.revision) return false;
    this.sessionId = snapshot.sessionId;
    this.revision = snapshot.revision;
    this.sources = new Set(snapshot.includedUris.filter(
      (uri): uri is string => typeof uri === 'string' && uri.startsWith('file:')
    ));
    return true;
  }

  includes(uri: string): boolean {
    return this.sources.has(uri);
  }
}
