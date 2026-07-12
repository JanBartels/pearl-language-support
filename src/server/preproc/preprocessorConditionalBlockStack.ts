// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from "../core";
import { MacroDefinition } from "./macroDefinition";

interface OpenPreprocessorConditionalBlock {

    readonly ifdef: boolean;

    readonly macro: string;

    readonly macroDefinition: MacroDefinition | undefined;

    readonly ifLocation: Location;

    elseLocation?: Location;

    readonly conditionSatisfied: boolean;
}

export class PreprocessorConditionalBlockStack {

    private readonly stack: OpenPreprocessorConditionalBlock[] = [];

    enterIfdef(
        macro: string,
        macroDefinition: MacroDefinition | undefined,
        location: Location
    ): void {

        this.stack.push({
            ifdef: true,
            macro,
            macroDefinition: macroDefinition
                ? { ...macroDefinition }
                : undefined,
            ifLocation: location,
            conditionSatisfied: macroDefinition !== undefined
        });
    }

    enterIfndef(
        macro: string,
        macroDefinition: MacroDefinition | undefined,
        location: Location
    ): void {

        this.stack.push({
            ifdef: false,
            macro,
            macroDefinition: macroDefinition
                ? { ...macroDefinition }
                : undefined,
            ifLocation: location,
            conditionSatisfied: macroDefinition === undefined
        });
    }

    current(): OpenPreprocessorConditionalBlock {
        return this.stack[this.stack.length - 1]!;
    }

    handleElse(
        location: Location
    ): void {

        this.current().elseLocation = location;
    }

    hasElse(): boolean {
        return this.current().elseLocation !== undefined;
    }

    leaveConditional(): OpenPreprocessorConditionalBlock {
        return this.stack.pop()!;
    }

    depth(): number {
        return this.stack.length;
    }

    isEmpty(): boolean {
        return this.stack.length === 0;
    }
}
