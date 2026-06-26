// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TokenStream } from "../lexer/tokenStream";

export class ExpansionStack {

    private readonly stack: TokenStream[] = [];

    push(stream: TokenStream): void {
        this.stack.push(stream);
    }

    pop(): TokenStream | undefined {
        return this.stack.pop();
    }

    peek(): TokenStream | undefined {
        return this.stack[this.stack.length - 1];
    }

    isEmpty(): boolean {
        return this.stack.length === 0;
    }

    clear(): void {
        this.stack.length = 0;
    }

    get size(): number {
        return this.stack.length;
    }
}