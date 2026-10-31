// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span } from '../core/span';
import { Location } from '../core/location';
import { Position } from '../core/position';

export interface Source {

    get uri(): string;

    get text(): string;

    get length(): number;

    getText(span?: Span): string;

    mapLocation(location: Location): Location;

    /**
     * Optional multi-origin mapping for composite sources.
     * Unlike mapLocation(), this retains every contributing source region.
     * Locations are returned in expanded-text order; they can still refer to
     * an intermediate Source and therefore require transitive mapping.
     */
    mapLocations?(location: Location): readonly Location[];
}
