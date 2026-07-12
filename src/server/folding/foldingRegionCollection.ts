// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core';
import { FoldingRegion } from './foldingRegion';

export class FoldingRegionCollection {

    private readonly regions: FoldingRegion[] = [];

    add(region: FoldingRegion): void {
        this.regions.push(region);
    }

    addAll(other: FoldingRegionCollection): void {
        for (const region of other) {
            this.add(region);
        }
    }

    size(): number {
        return this.regions.length;
    }

    isEmpty(): boolean {
        return this.regions.length === 0;
    }

    [Symbol.iterator](): Iterator<FoldingRegion> {
        return this.regions[Symbol.iterator]();
    }  

    toArray(): readonly FoldingRegion[] {
        return this.regions;
    }
}
