// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { createSpan } from '../core/span';
import { extendLocation, Location } from '../core';

export class FoldingRegion {

    constructor(
        readonly location: Location
    ) {}
}    

export function createInclusiveFoldingRegion(
    start: Location,
    end: Location
): FoldingRegion | undefined {

    if (start.source !== end.source) {
        return undefined;
    }

    return new FoldingRegion(
        extendLocation(start, end)
    );
}

export function createExclusiveFoldingRegion(
    start: Location,
    end: Location
): FoldingRegion | undefined {

    if (start.source !== end.source) {
        return undefined;
    }

    return new FoldingRegion({
        source: start.source,
        span: createSpan(
            start.span.start,
            end.span.start
        )
    });
}
