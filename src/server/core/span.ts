// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Position } from "./position";

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

export function extendSpan(
    a: Span,
    b: Span
): Span {
    return createSpan(
        Math.min(a.start, b.start),
        Math.max(a.end, b.end)
    );
}

export function contains(
    span: Span,
    offset: number
): boolean {

    return span.start <= offset
        && offset < span.end;
}

