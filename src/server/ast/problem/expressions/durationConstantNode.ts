// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from './expressionNode';

import { SourceValue } from '../../../core/sourceValue';

import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { DurationConstantDocumentationProvider } from '../../../documentation/problem/expressions/durationConstantDocumentationProvider';

export type DurationUnit = 'HRS' | 'MIN' | 'SEC';

export interface DurationConstantComponent {
    readonly value: SourceValue<string>;
    readonly unit: SourceValue<DurationUnit>;
}

export class DurationConstantNode extends ExpressionNode {
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
        position: SourceOffset
    ): AstLookupResult | undefined {
        for (const component of this.components) {
            const result = this.lookupOwnSourceValue(position, component.value)
                ?? this.lookupOwnSourceValue(position, component.unit);

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
