// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { contains } from "../core";
import { Source } from "../source/source";
import { PreprocessorConditionalBlockCollection } from "./preprocessorConditionalBlockCollection";
import { PreprocessorConditionalLookupResult, PreprocessorDirectiveKind } from "./preprocessorConditionalLookupResult";

export class PreprocessorConditionalBlockLookup {

    static lookup(
        source: Source,
        blocks: PreprocessorConditionalBlockCollection,
        offset: number
    ): PreprocessorConditionalLookupResult | undefined {

        for (const block of blocks) {

            if (block.ifLocation.source !== source) {
                continue;
            }

            if (contains(block.ifLocation.span, offset)) {
                return {
                    block,
                    directive: block.ifdef
                        ? PreprocessorDirectiveKind.Ifdef
                        : PreprocessorDirectiveKind.Ifndef
                };
            }

            if (
                block.elseLocation
                && contains(block.elseLocation.span, offset)
            ) {
                return {
                    block,
                    directive: PreprocessorDirectiveKind.Else
                };
            }

            if (contains(block.endifLocation.span, offset)) {
                return {
                    block,
                    directive: PreprocessorDirectiveKind.Endif
                };
            }
        }

        return undefined;
    }
}
