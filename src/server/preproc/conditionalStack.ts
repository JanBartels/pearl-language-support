// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

interface ConditionalState {
    active: boolean;
    elseSeen: boolean;
}

export class ConditionalStack {

    private readonly stack: ConditionalState[] = [];

    isActive(): boolean {
        return this.stack.length === 0
            ? true
            : this.stack[this.stack.length - 1]!.active;
    }

    enterIfdef(defined: boolean): void {
        this.stack.push({
            active: this.isActive() && defined,
            elseSeen: false
        });
    }

    enterIfndef(defined: boolean): void {
        this.stack.push({
            active: this.isActive() && !defined,
            elseSeen: false
        });
    }

    hasElse(): boolean {
        return this.stack[this.stack.length - 1]!.elseSeen;
    }    

    handleElse(): void {

        const state = this.stack.pop()!;

        const parent =
            this.stack.length === 0
                ? true
                : this.stack[this.stack.length - 1]!.active;

        this.stack.push({
            active: parent && !state.active,
            elseSeen: true
        });
    }

    leaveConditional(): void {
        this.stack.pop();
    }

    depth(): number {
        return this.stack.length;
    }

    isEmpty(): boolean {
        return this.stack.length === 0;
    }
}
