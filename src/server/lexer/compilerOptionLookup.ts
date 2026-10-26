// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { contains } from "../core";
import { SourceOffset, containsSourceOffset } from "../core/sourceOffset";
import { CommentToken, CompilerOption } from "./";

export class CompilerOptionLookup {

    /** Only options originating in the requested physical document can match. */
    static lookupAt(
        comments: readonly CommentToken[],
        position: SourceOffset
    ): CompilerOption | undefined {
        for (const comment of comments) {
            if (containsSourceOffset(comment.location, position)) {
                const option = comment.compilerOption();
                if (option) return option;
            }
        }
        return undefined;
    }

    static lookup(
        comments: readonly CommentToken[],
        offset: number
    ): CompilerOption | undefined {

        for (const comment of comments) {

            if (!contains(comment.location.span, offset)) {
                continue;
            }

            const option = comment.compilerOption();

            if (option) {
                return option;
            }
        }

        return undefined;
    }
}
