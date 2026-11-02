// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Position } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Editors may place the caret *after* a selected identifier (e.g. on double
 * click). Return the position of its last character, but only at a lexical
 * identifier boundary. This is an LSP interaction fallback, not a change to
 * compiler Locations or their half-open range semantics.
 *
 * The character classes match the PEARL lexer's identifier characters.
 */
export function identifierEndFallbackPosition(
    document: TextDocument,
    position: Position
): Position | undefined {
    const offset = document.offsetAt(position);
    if (offset === 0) return undefined;

    const text = document.getText();
    if (!isIdentifierPart(text.charCodeAt(offset - 1))
        || isIdentifierPart(text.charCodeAt(offset))) {
        return undefined;
    }

    return document.positionAt(offset - 1);
}

function isIdentifierPart(code: number): boolean {
    return code >= 65 && code <= 90    // A-Z
        || code >= 97 && code <= 122   // a-z
        || code >= 48 && code <= 57    // 0-9
        || code === 95;                // _
}
