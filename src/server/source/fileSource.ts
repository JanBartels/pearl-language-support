// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span } from '../core';
import { Position } from '../core/position';
import { Source } from './source';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class FileSource implements Source {

  readonly _uri: string;
  readonly _text: string;

  private readonly lineOffsets: [number, ...number[]];  

  constructor(uri: string, text: string) {
    this._uri = uri;
    this._text = text;
    const offsets = computeLineOffsets(text);
    this.lineOffsets = offsets as [number, ...number[]];
  }

  static fromDocument(document: TextDocument): FileSource {
    return new FileSource(
      document.uri,
      document.getText()
    );
  }

  get uri(): string {
      return this._uri;
  }

  get text(): string {
      return this._text;
  }

  get length(): number {
      return this._text.length;
  }

  getText(span?: Span): string {
    if (!span) return this._text;
    return this._text.slice(span.start, span.end);
  }

  positionAt(offset: number): Position {
    offset = clamp(offset, 0, this._text.length);

    let low = 0;
    let high = this.lineOffsets.length - 1;

    while (low <= high) {
        const mid = (low + high) >> 1;
        const lineOffset = this.lineOffsets[mid]!;

        if (lineOffset > offset) {
        high = mid - 1;
        } else {
        low = mid + 1;
        }
    }

    const line = clamp(low - 1, 0, this.lineOffsets.length - 1);
    const lineOffset = this.lineOffsets[line]!;

    return {
        line,
        character: offset - lineOffset
    };
  }

  offsetAt(line: number, character: number): number {
    if (line < 0 || line >= this.lineOffsets.length) {
        return this._text.length;
    }

    const lineOffset = this.lineOffsets[line]!;

    return clamp(
        lineOffset + character,
        0,
        this._text.length
    );
  }
}

function computeLineOffsets(text: string): number[] {
  const result: number[] = [0];

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);

    if (ch === 13 /* \r */) {
      if (i + 1 < text.length && text.charCodeAt(i + 1) === 10) {
        i++;
      }
      result.push(i + 1);
    } else if (ch === 10 /* \n */) {
      result.push(i + 1);
    }
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
