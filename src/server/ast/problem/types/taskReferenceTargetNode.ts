// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstKind } from "../../astKind";
import { AstNode } from "../../astNode";
import { AstLookupResult } from "../../astLookupResult";

export class TaskReferenceTargetNode extends AstNode {
    constructor(public readonly keyword: SourceValue<string>) {
        super(AstKind.TaskReferenceTarget);
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword);
    }

    override dumpLabel(): string { return "TaskReferenceTarget(TASK)"; }
    override getChildren(): readonly AstNode[] { return []; }
}
