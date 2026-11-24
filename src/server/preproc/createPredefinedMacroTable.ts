// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { PearlSettings } from '../settings/pearlSettings';
import { MacroTable } from './macroTable';

/** A fresh macro environment for one translation unit, shared by capture and validation. */
export function createPredefinedMacroTable(settings: PearlSettings): MacroTable {
    const macros = new MacroTable();
    for (const [name, value] of Object.entries(settings.macros ?? {})) {
        macros.define(name, value === '' ? null : value);
    }
    return macros;
}
