// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';

export interface MacroDefinition {

    readonly name: string;

    readonly replacement: string | null;

    readonly location?: Location;
}
