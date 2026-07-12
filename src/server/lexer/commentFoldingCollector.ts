// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";

import { CommentToken } from "./token";

import { createInclusiveFoldingRegion } from "../folding/foldingRegion";
import { FoldingRegionCollection } from "../folding/foldingRegionCollection";

export class CommentFoldingCollector {

    static collect(
        source: Source,
        comments: readonly CommentToken[],
        regions: FoldingRegionCollection
    ): void {

        for (const comment of comments) {

            if (comment.location.source !== source) {
                continue;
            }
                        
            const region = createInclusiveFoldingRegion(
                comment.location,
                comment.location
            );

            if (region) {
                regions.add(region);
            }
        }
    }
}
