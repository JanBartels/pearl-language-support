// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ProblemDataAttributeNode } from "./problemDataAttributeNode";
import { SemaAttributeNode } from "./semaAttributeNode";
import { BoltAttributeNode } from "./boltAttributeNode";
import { DclDationAttributeNode } from "./dclDationAttributeNode";

export type DclAttributeNode =
    ProblemDataAttributeNode
    | SemaAttributeNode
    | BoltAttributeNode
    | DclDationAttributeNode;
