// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * Tagged template for Markdown.
 *
 * Dynamic values in prose are escaped so that they cannot accidentally
 * introduce Markdown syntax. Code spans and fenced blocks preserve literals.
 *
 * Example:
 *
 *   md`
 *   # Interrupt
 *
 *   Mask: **${mask}**
 *   `
 *
 * Dynamic text is escaped only in Markdown prose. Within a Markdown code span
 * or fenced code block, a backslash is visible rather than an escape, so
 * escaping ordinary punctuation would corrupt source names and file paths.
 *
 * The context is derived only from the literal parts of the template. That
 * keeps dynamic content from being interpreted as Markdown while formatting.
 */
export function md(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
): string {
    let result = "";
    let inlineDelimiter = 0;
    let fenceDelimiter = 0;

    for (let i = 0; i < strings.length; i++) {
        const literal = strings[i]!;
        result += literal;

        // A run of backticks is a Markdown delimiter. A fenced block takes
        // precedence over inline-code spans, including its language header.
        for (let pos = 0; pos < literal.length;) {
            if (literal[pos] !== '`') {
                pos++;
                continue;
            }
            const start = pos;
            while (literal[pos] === '`') pos++;
            const count = pos - start;
            if (fenceDelimiter) {
                if (count >= fenceDelimiter) fenceDelimiter = 0;
            } else if (inlineDelimiter) {
                if (count === inlineDelimiter) inlineDelimiter = 0;
            } else if (count >= 3) {
                fenceDelimiter = count;
            } else {
                inlineDelimiter = count;
            }
        }

        if (i < values.length) {
            const value = String(values[i]);
            result += (inlineDelimiter || fenceDelimiter) ? value : escapeMarkdown(value);
        }
    }
    return result;
}

export function escapeMarkdown(
    text: string
): string {

    return text.replaceAll(
        /([\\`*_{}[\]()#+\-.!|>])/g,
        "\\$1"
    );
}
