// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export interface Span {
  /** inclusive */
  start: number;

  /** exclusive */
  end: number;
}

export function createSpan(start: number, end: number): Span {
  if (end < start) {
    throw new Error(`Invalid span: end (${end}) < start (${start})`);
  }

  return { start, end };
}

export function spanLength(span: Span): number {
  return span.end - span.start;
}

export function spansOverlap(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}
