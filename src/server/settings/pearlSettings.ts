// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export type TraceServerMode = 'off' | 'messages' | 'verbose';
export type WorkingDirMode = 'file' | 'workspace';

export interface PearlSettings {
  maxNumberOfProblems: number;
  traceServer: TraceServerMode;
  workingDirMode: WorkingDirMode;
  /**
   * Vordefinierte Präprozessor-Makros.
   *
   * key   = Makroname
   * value = Ersetzungstext
   *         "" bedeutet Makro ohne Ersetzungstext (#define NAME)
   */
  macros: Record<string, string>;
}

// Default settings (fallback if client does not support workspace/configuration)
export const defaultSettings: PearlSettings = {
  maxNumberOfProblems: 100,
  traceServer: 'off',
  workingDirMode: 'file',
  macros: {}
}
