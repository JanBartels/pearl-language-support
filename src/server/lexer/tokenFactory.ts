// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
    Token,
    TokenKind,
    CommentToken,
    CommentKind,
    CompilerOption
} from './';
import { Location } from '../core/location';

export function createToken(
  kind: TokenKind,
  location: Location
): Token {

  return Object.freeze({
    kind,
    location
  });
}

export function createCommentToken(
    location: Location,
    commentKind: CommentKind
): CommentToken {

    return Object.freeze({
        kind: TokenKind.Comment,
        location,
        commentKind,
        compilerOption(): CompilerOption | undefined {
            if (this.commentKind !== CommentKind.Block) {
                return undefined;
            }

            return parseCompilerOption(this.location);
        }        
    });
}

function parseCompilerOption(location: Location): CompilerOption | undefined {

    const text = location.source.getText(location.span);

    // /* ... */
    if (text.length < 6) {
        return undefined;
    }

    const mode = text.charAt(2);
    if (mode !== '+' && mode !== '-') {
        return undefined;
    }

    return {
        mode: mode === '+',
        option: text.substring(3, text.length - 2).trimEnd()
    };
}