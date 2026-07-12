// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { AstLookupResult } from './astLookupResult';
import { Source } from "../source/source";
import { SourceValue } from '../core/sourceValue';
import { DocumentationProvider } from '../documentation/documentationProvider';
import { FoldingRegionCollection } from '../folding/foldingRegionCollection';

export abstract class AstNode {

    parent?: AstNode;

    abstract documentationProvider(): DocumentationProvider<this> | undefined;    

    protected constructor(
        readonly kind: AstKind
    ) {}

    adopt<T extends AstNode>(child: T): T {
        child.parent = this;
        return child;
    }

    adoptAll<T extends AstNode>(children: readonly T[]): readonly T[] {
        return children.map(child => this.adopt(child));
    }

    /**
     * Looks up the syntactic language element at the specified source offset.
     *
     * Returns the AST node together with the matching SourceValue,
     * or undefined if this subtree does not cover the offset.
     */
    abstract lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined;

    protected lookupOwnSourceValue(
        offset: number,
        sourceValue: SourceValue<unknown> | undefined
    ): AstLookupResult | undefined {

        if (!sourceValue?.contains(offset)) {
            return undefined;
        }

        return {
            node: this,
            element: sourceValue
        };
    }

    /**
     * Folding
     */
    addFoldingRegionsTo(
        source: Source,
        regions: FoldingRegionCollection
    ): void {
        // Default: no folding regions.
    }

    public dumpLabel(): string {
        return AstKind[this.kind];
    }

    public getChildren(): readonly AstNode[] {
        return [];
    }

}