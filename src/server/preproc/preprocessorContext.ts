// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentRegistry } from '../utility/documentRegistry';
import { MacroTable } from './macroTable';
import { ConditionalStack } from './conditionalStack';
import { PreprocessorConditionalBlockStack } from './preprocessorConditionalBlockStack';
import type { MacroDefinition } from './macroDefinition';
import type { CommentToken } from '../lexer/token';

export class PreprocessorContext {

  /** Definitions seen during this preprocessing run, including redefinitions
   * and definitions that are subsequently removed by #undef. The identity of
   * each entry is shared with MacroReference.definition. */
  readonly macroDefinitions: MacroDefinition[] = [];

  /** Block comments in the active, preprocessed token stream, including
   * nested includes and macro expansions, with their original Source identity.
   * The AST deliberately does not own these documentation comments. */
  readonly activeBlockComments: CommentToken[] = [];

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
