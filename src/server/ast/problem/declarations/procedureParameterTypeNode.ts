// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';

/** Parameter-only types (real-time objects and DATION). */
export class ProcedureParameterTypeNode extends AstNode {
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly qualifiers: readonly SourceValue<string>[]
    ) {
        super(AstKind.ProcedureParameterType);
    }

    override documentationProvider(): DocumentationProvider<this> | undefined {
        return undefined;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const token of [this.keyword, ...this.qualifiers]) {
            const result = this.lookupOwnSourceValue(position, token);
            if (result) return result;
        }
        return undefined;
    }

    override getChildren(): readonly AstNode[] {
        return [];
    }

    override dumpLabel(): string {
        return `ProcedureParameterType(${[this.keyword, ...this.qualifiers]
            .map(token => token.value).join(' ')})`;
    }
}
