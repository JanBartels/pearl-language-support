// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset, containsSourceOffset } from "../core/sourceOffset";
import { PreprocessorConditionalBlockCollection } from "./preprocessorConditionalBlockCollection";
import { PreprocessorConditionalLookupResult, PreprocessorDirectiveKind } from "./preprocessorConditionalLookupResult";

export class PreprocessorConditionalBlockLookup {

    static lookup(
        blocks: PreprocessorConditionalBlockCollection,
        position: SourceOffset,
        includeOccurrenceId?: string
    ): PreprocessorConditionalLookupResult | undefined {

        for (const block of blocks) {
            // Physical positions in a header can occur in several executions.
            // The selected include occurrence determines which condition was evaluated.
            if (includeOccurrenceId !== undefined
                && block.includeOccurrenceId !== includeOccurrenceId) continue;

            // Directive and tested macro are distinct physical tokens. The
            // DocumentationProvider describes the same evaluated condition for
            // either token; whitespace and unrelated macro uses are excluded.
            if (containsSourceOffset(block.ifLocation, position)
                || containsSourceOffset(block.macroLocation, position)) {
                return {
                    block,
                    directive: block.ifdef
                        ? PreprocessorDirectiveKind.Ifdef
                        : PreprocessorDirectiveKind.Ifndef
                };
            }

            if (
                block.elseLocation
                && containsSourceOffset(block.elseLocation, position)
            ) {
                return {
                    block,
                    directive: PreprocessorDirectiveKind.Else
                };
            }

            if (containsSourceOffset(block.endifLocation, position)) {
                return {
                    block,
                    directive: PreprocessorDirectiveKind.Endif
                };
            }
        }

        return undefined;
    }
}
