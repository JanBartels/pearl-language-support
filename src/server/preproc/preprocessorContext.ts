// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentRegistry } from '../utility/documentRegistry';
import { MacroTable } from './macroTable';
import { ConditionalStack } from './conditionalStack';
import { PreprocessorConditionalBlockStack } from './preprocessorConditionalBlockStack';

export class PreprocessorContext {

  constructor(

    /**
     * Zugriff auf bereits geladene Dokumente.
     */
    readonly documentRegistry: DocumentRegistry,

    /**
     * Aktueller Makrozustand.
     */
    readonly macroTable: MacroTable,

    /**
     * Aktueller Makrozustand.
     */
    readonly conditionals: ConditionalStack,
    
    /**
     * Aktueller Stack für Präprozessordirektiven #ifdef/#ifndef, #else, #endif.
     */
    readonly conditionalBlocks: PreprocessorConditionalBlockStack
  ) {}

}
