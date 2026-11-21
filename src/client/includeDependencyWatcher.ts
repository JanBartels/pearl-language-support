// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A complete, monotonically versioned server-side include dependency set. */
export interface IncludeWatchSnapshot {
  /** Identifies a Language Server process; revisions reset after a restart. */
  readonly sessionId?: string;
  readonly revision: number;
  readonly uris: readonly string[];
}

/** LSP FileChangeType: Created=1, Changed=2, Deleted=3. */
export type IncludeFileChangeType = 1 | 2 | 3;

export interface IncludeWatchHandle {
  dispose(): void;
}

/** The VS Code adapter creates one nonrecursive watcher per parent directory. */
export type DirectoryWatchFactory = (
  directory: string,
  onChange: (uri: string, type: IncludeFileChangeType) => void
) => IncludeWatchHandle;

function fileDirectory(uri: string): string | undefined {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'file:' ? path.dirname(fileURLToPath(parsed)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Tracks the include paths discovered by accepted compiler runs.
 * No extension filters or recursive directory scans: PEARL includes may have
 * any suffix and may live outside every opened workspace folder.
 *
 * A rejected older snapshot cannot undo a more recent dependency graph.
 */
export class IncludeDependencyWatcher {
  private revision = -1;
  private sessionId: string | undefined;
  private targets = new Set<string>();
  private readonly directories = new Map<string, IncludeWatchHandle>();

  constructor(
    private readonly watchDirectory: DirectoryWatchFactory,
    private readonly onChange: (uri: string, type: IncludeFileChangeType) => void,
    private readonly shouldWatch: (uri: string) => boolean = () => true
  ) {}

  update(snapshot: IncludeWatchSnapshot): void {
    if (!snapshot || !Number.isInteger(snapshot.revision)
        || !Array.isArray(snapshot.uris)) return;
    if (snapshot.sessionId === this.sessionId && snapshot.revision <= this.revision) return;

    const nextTargets = new Set<string>();
    const nextDirectories = new Set<string>();
    for (const uri of snapshot.uris) {
      if (typeof uri !== 'string' || !this.shouldWatch(uri)) continue;
      const directory = fileDirectory(uri);
      if (!directory) continue;
      nextTargets.add(uri);
      nextDirectories.add(directory);
    }

    // Update targets BEFORE registering watchers; the first event is eligible.
    this.targets = nextTargets;
    this.sessionId = snapshot.sessionId;
    this.revision = snapshot.revision;
    for (const [directory, watcher] of this.directories) {
      if (!nextDirectories.has(directory)) {
        watcher.dispose();
        this.directories.delete(directory);
      }
    }
    for (const directory of nextDirectories) {
      if (this.directories.has(directory)) continue;
      this.directories.set(directory, this.watchDirectory(directory, (uri, type) => {
        // A directory watcher sees unrelated files, which must not invalidate
        // any translation unit. Include create/delete are explicitly supported.
        if (this.targets.has(uri)) this.onChange(uri, type);
      }));
    }
  }

  dispose(): void {
    for (const watcher of this.directories.values()) watcher.dispose();
    this.directories.clear();
    this.targets.clear();
  }
}
