// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span } from './span';
import { Source } from '../source/source';

export interface Location {
  readonly source: Source
  readonly span: Span;
}
