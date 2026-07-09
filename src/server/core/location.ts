// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span, extendSpan } from './span';
import { Source } from '../source/source';

export interface Location {
  readonly source: Source
  readonly span: Span;
}

export function extendLocation(
    start: Location,
    end: Location
): Location {

    if (start.source !== end.source) {
        throw new Error("Cannot extend locations from different sources.");
    }

    return {
        source: start.source,
        span: extendSpan(
            start.span,
            end.span
        )
    };
}
