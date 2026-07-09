// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * Tagged template for Markdown.
 *
 * Dynamic values are automatically escaped so that they cannot
 * accidentally introduce Markdown syntax.
 *
 * Example:
 *
 *   md`
 *   # Interrupt
 *
 *   Mask: **${mask}**
 *   `
 */
export function md(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
): string {

    let result = "";
    
    for (let i = 0; i < strings.length; i++) {
        result += strings[i]!;
        if (i < values.length) {
            result += escapeMarkdown(String(values[i]));
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
