// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export class MacroTable {

  private readonly macros = new Map<string, string>();

  has(name: string): boolean {
    return this.macros.has(name);
  }

  get(name: string): string | undefined {
    return this.macros.get(name);
  }

  define(name: string, value: string): void {
    this.macros.set(name, value);
  }

  undefine(name: string): void {
    this.macros.delete(name);
  }

  clear(): void {
    this.macros.clear();
  }

}
