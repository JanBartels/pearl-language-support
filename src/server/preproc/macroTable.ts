// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from "../core/location";
import { MacroDefinition } from "./macroDefinition";

export class MacroTable {

  private readonly macros = new Map<string, MacroDefinition>();

  get(name: string): MacroDefinition | undefined {
    return this.macros.get(name);
  }

  define(name: string, value: string|null, location?: Location): boolean {
    const redefined = this.macros.get(name) !== undefined;
    this.macros.set(name, { 
      name,
      replacement: value,
      ...(location ? { location } : {})
    });
    return redefined;
  }

  undefine(name: string): boolean {
    const defined = this.macros.get(name) != undefined;
    this.macros.delete(name);
    return defined;
  }

  clear(): void {
    this.macros.clear();
  }

}
