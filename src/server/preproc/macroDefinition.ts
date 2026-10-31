// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';

export interface MacroDefinition {

    readonly name: string;

    readonly replacement: string | null;

    /** Literal contents between the quotes of a source #define, if available. */
    readonly replacementLocation?: Location;

    readonly location?: Location;

    /** The #define keyword, if introduced in source (not through settings). */
    readonly directiveLocation?: Location;
}
