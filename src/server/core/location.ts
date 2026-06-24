// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span } from './span';

export interface Location {
  uri: string;
  span: Span;
}
