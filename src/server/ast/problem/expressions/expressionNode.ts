// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';

/** Syntactic base for general expressions; no semantic type or binding. */
export abstract class ExpressionNode extends AstNode {
    protected constructor(kind: AstKind) { super(kind); }
}
