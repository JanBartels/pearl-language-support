// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';
import { MacroDefinition } from './macroDefinition';

export interface MacroReference {

    /**
     * Definition of the invoked macro.
     */
   readonly definition: MacroDefinition;

    /**
     * Location of the macro invocation in the original source.
     */
    readonly location: Location;
}
