// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** Transport-neutral data shared by the Definition middleware and editor events. */
export interface NavigationIntent {
  readonly uri: string;
  readonly unitUri: string;
  readonly occurrenceId: string;
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}

/**
 * A read-only definition request is not a navigation. An intent may only be
 * consumed by a subsequent real editor activation/selection at the target.
 * In particular, Peek must not set a persistent context by itself.
 */
export class PendingNavigationIntent {
  private pending: { intent: NavigationIntent; expires: number } | undefined;

  constructor(private readonly ttlMs = 4000) {}

  remember(intent: NavigationIntent, now = Date.now()): void {
    this.pending = { intent, expires: now + this.ttlMs };
  }

  take(uri: string, line: number, character: number, now = Date.now()): NavigationIntent | undefined {
    const entry = this.pending;
    if (!entry) return undefined;
    if (now > entry.expires) {
      this.pending = undefined;
      return undefined;
    }
    const { intent } = entry;
    // A tab opened manually later must not inherit an unrelated definition
    // request. Navigation positions may select either the start or the name.
    const onTarget = uri === intent.uri && line === intent.start.line
      && character >= intent.start.character
      && (line !== intent.end.line || character <= intent.end.character);
    if (!onTarget) return undefined;
    this.pending = undefined;
    return intent;
  }
}
