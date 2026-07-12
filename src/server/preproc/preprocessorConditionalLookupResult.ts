// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { PreprocessorConditionalBlock } from "./preprocessorConditionalBlock";

export enum PreprocessorDirectiveKind {
    Ifdef,
    Ifndef,
    Else,
    Endif
}

export interface PreprocessorConditionalLookupResult {

    readonly block: PreprocessorConditionalBlock;

    readonly directive: PreprocessorDirectiveKind;
}
