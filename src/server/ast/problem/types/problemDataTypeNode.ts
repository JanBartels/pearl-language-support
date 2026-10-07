// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SimpleTypeNode } from "./simpleTypeNode";
import { NamedTypeNode } from "./namedTypeNode";
import { StructTypeNode } from "./structTypeNode";
import { RefTypeNode } from "./refTypeNode";

export type ProblemDataTypeNode =
    | SimpleTypeNode
    | NamedTypeNode
    | StructTypeNode
    | RefTypeNode
    ;
    