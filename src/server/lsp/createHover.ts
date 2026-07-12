// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
    Hover,
    MarkupKind
} from "vscode-languageserver";

export function createHover(
    markdown: string
): Hover {

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: markdown
        }
    };
}
