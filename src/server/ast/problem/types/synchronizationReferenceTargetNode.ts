// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstNode } from "../../astNode";
import { AstLookupResult } from "../../astLookupResult";

/** The RTOS-UH synchronization object types that may be referenced. */
export class SynchronizationReferenceTargetNode extends AstNode {

    constructor(public readonly keyword: SourceValue<string>) {
        super(AstKind.SynchronizationReferenceTarget);
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword);
    }

    override getChildren(): readonly AstNode[] { return []; }

    override dumpLabel(): string {
        return `SynchronizationReferenceTarget(${this.keyword.value})`;
    }
}
