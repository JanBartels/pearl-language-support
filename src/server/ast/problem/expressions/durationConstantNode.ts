// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';

import { SourceValue } from '../../../core/sourceValue';

import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { DurationConstantDocumentationProvider } from '../../../documentation/problem/expressions/durationConstantDocumentationProvider';

export type DurationUnit = 'HRS' | 'MIN' | 'SEC';

export interface DurationConstantComponent {
    readonly value: SourceValue<string>;
    readonly unit: SourceValue<DurationUnit>;
}

export class DurationConstantNode extends AstNode {
    private static readonly provider =
        new DurationConstantDocumentationProvider();

    constructor(
        public readonly components: readonly DurationConstantComponent[]
    ) {
        super(AstKind.DurationConstant);
    }

    override documentationProvider():
        DocumentationProvider<DurationConstantNode> {
        return DurationConstantNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {
        for (const component of this.components) {
            const result = this.lookupOwnSourceValue(offset, component.value)
                ?? this.lookupOwnSourceValue(offset, component.unit);

            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        const value = this.components
            .map(component => `${component.value.value} ${component.unit.value}`)
            .join(' ');

        return `DurationConstant(${value})`;
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }
}
