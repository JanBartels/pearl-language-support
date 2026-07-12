// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export interface CompilerOption {
    readonly mode: boolean;   // + oder -
    readonly option: string;  // "L", "R=1234", "D=FIXED(15)", ...
}
