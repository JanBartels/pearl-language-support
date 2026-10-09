// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcBoltAttributeNode } from './spcBoltAttributeNode';
import { SpcProblemDataAttributeNode } from './spcProblemDataAttributeNode';
import { SpcSemaAttributeNode } from './spcSemaAttributeNode';

export type SpcAttributeNode = SpcProblemDataAttributeNode | SpcSemaAttributeNode | SpcBoltAttributeNode;
