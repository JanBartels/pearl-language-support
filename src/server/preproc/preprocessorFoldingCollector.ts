// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";
import { createExclusiveFoldingRegion } from "../folding/foldingRegion";
import { FoldingRegionCollection } from "../folding/foldingRegionCollection";

import { PreprocessorConditionalBlockCollection } from "./preprocessorConditionalBlockCollection";

export class PreprocessorFoldingCollector {

    static collect(
        source: Source,
        blocks: PreprocessorConditionalBlockCollection,
        regions: FoldingRegionCollection
    ): void {

        for (const block of blocks) {

            if (block.ifLocation.source !== source) {
                continue;
            }

            //
            // #ifdef/#ifndef ... #else
            // oder
            // #ifdef/#ifndef ... #endif
            //
            const first = createExclusiveFoldingRegion(
                block.ifLocation,
                block.elseLocation ?? block.endifLocation
            );

            if (first) {
                regions.add(first);
            }

            //
            // #else ... #endif
            //
            if (block.elseLocation) {

                const second = createExclusiveFoldingRegion(
                    block.elseLocation,
                    block.endifLocation
                );

                if (second) {
                    regions.add(second);
                }
            }
        }
    }
}
