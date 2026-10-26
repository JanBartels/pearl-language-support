// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset, containsSourceOffset } from "../core/sourceOffset";
import { PreprocessorConditionalBlockCollection } from "./preprocessorConditionalBlockCollection";
import { PreprocessorConditionalLookupResult, PreprocessorDirectiveKind } from "./preprocessorConditionalLookupResult";

export class PreprocessorConditionalBlockLookup {

    static lookup(
        blocks: PreprocessorConditionalBlockCollection,
        position: SourceOffset
    ): PreprocessorConditionalLookupResult | undefined {

        for (const block of blocks) {

            if (containsSourceOffset(block.ifLocation, position)) {
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
