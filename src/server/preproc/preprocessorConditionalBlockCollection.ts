// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { PreprocessorConditionalBlock } from './preprocessorConditionalBlock';

export class PreprocessorConditionalBlockCollection {

    private readonly blocks: PreprocessorConditionalBlock[] = [];

    add(
        block: PreprocessorConditionalBlock
    ): void {
        this.blocks.push(block);
    }

    addAll(
        other: PreprocessorConditionalBlockCollection
    ): void {

        for (const block of other) {
            this.add(block);
        }
    }

    size(): number {
        return this.blocks.length;
    }

    isEmpty(): boolean {
        return this.blocks.length === 0;
    }

    [Symbol.iterator](): Iterator<PreprocessorConditionalBlock> {
        return this.blocks[Symbol.iterator]();
    }

    toArray(): readonly PreprocessorConditionalBlock[] {
        return this.blocks;
    }

}