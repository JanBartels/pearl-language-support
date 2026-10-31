// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { MacroDefinition } from './macroDefinition';
import type { MacroReference } from './macroReference';
import { MacroSource } from '../source/macroSource';

/** A fragment of recursively expanded macro text. It is NOT a PEARL token. */
export interface MacroTextFragment {
    readonly text: string;
    readonly invocation: Location;
}

export interface MacroTextExpansion {
    readonly fragments: readonly MacroTextFragment[];
    readonly references: readonly MacroReference[];
}

/**
 * Expand names inside a macro replacement without lexing its result as PEARL.
 * Thus comment delimiter fragments can be emitted separately and only
 * interpreted by the final compiler lexer after the whole output is assembled.
 *
 * This deliberately does not process #directives, source comments or includes.
 * Those remain the responsibility of the surrounding external preprocessor.
 */
export function expandMacroText(
    definition: MacroDefinition,
    invocation: Location,
    lookup: (name: string) => MacroDefinition | undefined,
    onError: (location: Location, message: string) => void,
    maxDepth = 100
): MacroTextExpansion {
    const fragments: MacroTextFragment[] = [];
    const references: MacroReference[] = [];
    const stack: string[] = [];

    function visit(macro: MacroDefinition, referenceLocation: Location): void {
        references.push({ definition: macro, location: referenceLocation });
        if (stack.includes(macro.name)) {
            onError(invocation, `Recursive macro expansion: ${[...stack, macro.name].join(' -> ')}.`);
            return;
        }
        if (stack.length >= maxDepth) {
            onError(invocation, `Maximum macro depth (${maxDepth}) exceeded.`);
            return;
        }
        if (macro.replacement === null) return;
        stack.push(macro.name);
        try {
            const text = macro.replacement;
            let start = 0;
            let index = 0;
            let inString = false;
            const flush = (end: number) => {
                if (end > start) fragments.push({ text: text.slice(start, end), invocation });
            };
            while (index < text.length) {
                const char = text[index]!;
                // PEARL string constants use apostrophes. Do not expand names
                // inside them. Doubled apostrophes remain part of the string.
                if (char === "'") {
                    if (inString && text[index + 1] === "'") { index += 2; continue; }
                    inString = !inString;
                    index++;
                    continue;
                }
                if (!inString && /[A-Za-z]/.test(char)) {
                    const nameStart = index++;
                    while (index < text.length && /[A-Za-z0-9_]/.test(text[index]!)) index++;
                    const nested = lookup(text.slice(nameStart, index));
                    if (nested) {
                        flush(nameStart);
                        // A nested invocation is written inside the containing
                        // macro's definition, not at the outer invocation in the
                        // PEARL program. Preserve its exact physical location.
                        // Predefined macros have no source definition: represent
                        // those references as generated so the directly written
                        // outer invocation still wins ambiguous editor lookups.
                        const replacement = macro.replacementLocation;
                        const nestedLocation: Location = replacement
                            ? {
                                source: replacement.source,
                                span: {
                                    start: replacement.span.start + nameStart,
                                    end: replacement.span.start + index
                                }
                            }
                            : {
                                source: new MacroSource(invocation, text.slice(nameStart, index)),
                                span: { start: 0, end: index - nameStart }
                            };
                        visit(nested, nestedLocation);
                        start = index;
                    }
                    continue;
                }
                index++;
            }
            flush(text.length);
        } finally {
            stack.pop();
        }
    }

    visit(definition, invocation);
    return { fragments, references };
}
