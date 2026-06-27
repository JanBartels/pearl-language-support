// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from '../source/source';
import { Span } from '../core';

export class CharStream {

  private readonly text: string;
  private readonly length: number;
  private pos = 0;

  constructor(private readonly source: Source) {
    this.text = source.text;
    this.length = this.text.length;
  }

  getSource(): Source {
    return this.source;
  }

  getText(span?: Span): string {
    return this.source.getText(span);
  }

  get uri(): string {
    return this.source.uri;
  }

  get offset(): number {
    return this.pos;
  }

  eof(): boolean {
    return this.pos >= this.length;
  }

  peek(offset = 0): number {
    const index = this.pos + offset;
    if (index >= this.length) return -1;
    return this.text.charCodeAt(index);
  }

  next(): number {
    if (this.pos >= this.length) return -1;
    return this.text.charCodeAt(this.pos++);
  }

  advance(count = 1): void {
    this.pos = Math.min(this.pos + count, this.length);
  }

  mark(): number {
    return this.pos;
  }

  reset(position: number): void {
    this.pos = position;
  }
}