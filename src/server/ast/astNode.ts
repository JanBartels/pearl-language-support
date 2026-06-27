// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { Location } from '../core/location';
import { SemanticContext } from '../semantic/semanticContext';

export abstract class AstNode {

    parent?: AstNode;

    protected constructor(
        readonly kind: AstKind,
        readonly location: Location,
    ) {}

    adopt<T extends AstNode>(child: T): T {
        child.parent = this;
        return child;
    }

    adoptAll<T extends AstNode>(children: readonly T[]): readonly T[] {
        return children.map(child => this.adopt(child));
    }

    public dumpLabel(): string {
        return AstKind[this.kind];
    }

    public getChildren(): readonly AstNode[] {
        return [];
    }

    resolveSymbols(context: SemanticContext): void {
    }

    validate(context: SemanticContext): void {
    }

    collectDocumentSymbols(): void {
    }

    collectSemanticTokens(): void {
    }

    collectFoldingRanges(): void {
    }
}