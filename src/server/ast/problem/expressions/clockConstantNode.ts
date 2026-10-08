// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';

import { SourceValue } from '../../../core/sourceValue';

import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { ClockConstantDocumentationProvider } from '../../../documentation/problem/expressions/clockConstantDocumentationProvider';

export class ClockConstantNode extends AstNode {
    private static readonly provider =
        new ClockConstantDocumentationProvider();

    constructor(
        public readonly hours: SourceValue<string>,
        public readonly minutes: SourceValue<string>,
        public readonly seconds: SourceValue<string>
    ) {
        super(AstKind.ClockConstant);
    }

    override documentationProvider():
        DocumentationProvider<ClockConstantNode> {
        return ClockConstantNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.hours)
            ?? this.lookupOwnSourceValue(offset, this.minutes)
            ?? this.lookupOwnSourceValue(offset, this.seconds);
    }

    public override dumpLabel(): string {
        return `ClockConstant(${this.hours.value}:${this.minutes.value}:${this.seconds.value})`;
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }
}
