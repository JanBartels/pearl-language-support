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
}
