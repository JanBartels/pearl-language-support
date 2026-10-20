// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { Source } from "../../../source/source";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createExclusiveFoldingRegion } from "../../../folding/foldingRegion";

/** Fold a branch without hiding the delimiter starting the following branch. */
export function addConditionalBranchFoldingRegion(
    source: Source,
    regions: FoldingRegionCollection,
    first: SourceValue<string> | undefined,
    next: SourceValue<string> | undefined
): void {
    const start = first?.location;
    const end = next?.location;
    if (!start || !end || start.source !== source || end.source !== source) {
        return;
    }

    // Error recovery can produce branches in an unexpected order. Never
    // pass a reversed or overlapping span to the folding infrastructure.
    if (end.span.start < start.span.end) {
        return;
    }

    const region = createExclusiveFoldingRegion(start, end);
    if (region) {
        regions.add(region);
    }
}
