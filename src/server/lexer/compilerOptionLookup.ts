// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { contains } from "../core";
import { CommentToken, CompilerOption } from "./";

export class CompilerOptionLookup {

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
