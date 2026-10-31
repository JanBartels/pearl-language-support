// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { MacroDefinition } from './macroDefinition';
import { expandMacroText } from './macroTextExpander';
import type { ExternalPreprocessorResultBuilder } from './externalPreprocessorResult';

/**
 * Connect recursive textual macro expansion to the external preprocessor output.
 * This adapter deliberately neither lexes the replacement nor interprets PEARL
 * comments. The compiler lexer must do that on the completed ExpandedSource.
 *
 * The caller owns macro lookup, diagnostics, conditional processing and includes.
 * It must call this writer exactly once per actual macro invocation, in the
 * same order in which the generated text appears in the output.
 */
export function appendExpandedMacro(
    output: ExternalPreprocessorResultBuilder,
    definition: MacroDefinition,
    invocation: Location,
    lookup: (name: string) => MacroDefinition | undefined,
    onError: (location: Location, message: string) => void,
    maxDepth = 100
): void {
    const expansion = expandMacroText(
        definition, invocation, lookup, onError, maxDepth
    );
    for (const fragment of expansion.fragments) {
        output.appendExpansion(fragment.text, fragment.invocation);
    }
    for (const reference of expansion.references) {
        output.addMacroReference(reference);
    }
}
