// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core';
import { MacroDefinition } from './macroDefinition';

export class PreprocessorConditionalBlock {

    constructor(

        /**
         * true = #ifdef
         * false = #ifndef
         */
        readonly ifdef: boolean,

        /**
         * Name des geprüften Makros.
         */
        readonly macro: string,

        /**
         * Definition des Makros zum Zeitpunkt des #ifdef/#ifndef.
         */
        readonly macroDefinition: MacroDefinition | undefined,

        /**
         * Position von #ifdef/#ifndef.
         */
        readonly ifLocation: Location,

        /**
         * Position von #else.
         */
        readonly elseLocation: Location | undefined,

        /**
         * Position von #endif.
         */
        readonly endifLocation: Location,

        /**
         * Bedingung von #ifdef/#ifndef erfüllt?
         */
        readonly conditionSatisfied: boolean

    ) {}

}
