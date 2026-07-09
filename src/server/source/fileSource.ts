// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span } from '../core/span';
import { Location } from '../core/location';
import { Source } from './source';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class FileSource implements Source {

  readonly _uri: string;
  readonly _text: string;

  constructor(uri: string, text: string) {
    this._uri = uri;
    this._text = text;
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

  mapLocation(location: Location): Location {
    return location;
  }

}
