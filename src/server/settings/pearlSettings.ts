// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export type TraceServerMode = 'off' | 'messages' | 'verbose';

export interface PearlSettings {
  maxNumberOfProblems: number;
  /** Warn when a CHAR value may be truncated during value transfer. */
  warnOnCharTruncation: boolean;
  traceServer: TraceServerMode;
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
  warnOnCharTruncation: true,
  traceServer: 'off',
  macros: {}
}
