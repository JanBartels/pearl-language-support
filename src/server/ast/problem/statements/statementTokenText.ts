// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

/** Display a preserved token sequence without changing the original SourceValues. */
export function statementTokenText(tokens: readonly SourceValue<string>[]): string {
    let result = "";
    let previous: SourceValue<string> | undefined;

    for (const token of tokens) {
        const left = previous?.location;
        const right = token.location;
        const adjacent = left && right && left.source === right.source
            && left.span.end === right.span.start;
        result += previous && !adjacent ? " " : "";
        result += token.value;
        previous = token;
    }

    return result;
}
