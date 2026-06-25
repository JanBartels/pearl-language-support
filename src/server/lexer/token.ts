// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core';
import { DocumentRegistry } from '../utility/documentRegistry';

export enum TokenKind {

  /** Ende der Eingabe */
  EOF,

  /** Zeilenende (\n oder \r\n) */
  Newline,

  /** Kommentar bis zum Zeilenende */
  Comment,

  /** Bezeichner (Schlüsselwörter werden zunächst ebenfalls als Identifier erkannt) */
  Identifier,

  /** Numerisches Literal */
  NumberLiteral,

  /** Zeichenkettenliteral */
  StringLiteral,

  /** Bitliteral ('...'B, '...'B1 bis '...'B4) */
  BitLiteral,

  /** Operator oder Trennzeichen */
  Operator,

  /**
   * Präprozessor- oder Compilerdirektive.
   *
   * Lexikalische Form:
   *   #<kleinbuchstaben>
   *   #<GROSSBUCHSTABEN>
   *
   * Beispiele:
   *   #define
   *   #ifdef
   *   #DEFINE
   *   #IF
   *
   * Die semantische Auswertung erfolgt erst im Präprozessor.
   */
  PreprocessorDirective,

  /**
   * Ungültige Direktive nach '#', z. B. gemischte Groß-/Kleinschreibung
   * (#Define) oder eine andere ungültige Schreibweise.
   */
  InvalidDirective
}

export interface Token {

  /** Lexikalischer Typ */
  readonly kind: TokenKind;

  /** Wo steht dieses Token im Ursprungsdokument? */
  readonly location: Location;

  /**
   * Falls dieses Token durch Macro-Expansion entstanden ist:
   * Wo wurde das Macro definiert?
   */
  readonly macroDefinition?: Location;
}

export interface NumberToken extends Token {
  readonly numericValue: number;
}

export function tokenText(
    token: Token,
    registry: DocumentRegistry
): string {

    const document = registry.get(token.location.uri);

    if (!document) {
        throw new Error(
            `Document not found: ${token.location.uri}`
        );
    }

    return document.getText({
        start: document.positionAt(token.location.span.start),
        end: document.positionAt(token.location.span.end)
    });
}
