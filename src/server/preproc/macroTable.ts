// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export class MacroTable {

  private readonly macros = new Map<string, string|null>();

  has(name: string): boolean {
    return this.macros.has(name);
  }

  get(name: string): string | null | undefined {
    return this.macros.get(name);
  }

  define(name: string, value: string|null): boolean {
    const redefined = this.macros.has(name);
    this.macros.set(name, value);
    return redefined;
  }

  undefine(name: string): boolean {
    const defined = this.macros.has(name);
    this.macros.delete(name);
    return defined;
  }

  clear(): void {
    this.macros.clear();
  }

}
