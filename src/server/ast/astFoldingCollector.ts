// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";

import { AstNode } from "./astNode";
import { FoldingRegionCollection } from "../folding/foldingRegionCollection";

export class AstFoldingCollector {

    static collect(
        source: Source,
        root: AstNode,
        regions: FoldingRegionCollection
    ): void {

        this.collectNode(source, root, regions);
    }

    private static collectNode(
        source: Source,
        node: AstNode,
        regions: FoldingRegionCollection
    ): void {

        node.addFoldingRegionsTo(source, regions);

        for (const child of node.getChildren()) {
            this.collectNode(source, child, regions);
        }
    }
}
