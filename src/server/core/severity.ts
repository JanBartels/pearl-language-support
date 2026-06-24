// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export const Severity = {
  Error: 'error',
  Warning: 'warning',
  Info: 'info',
  Hint: 'hint'
} as const;

export type Severity = typeof Severity[keyof typeof Severity];

export const SeverityRank: Record<keyof typeof Severity, number> = {
  Error: 3,
  Warning: 2,
  Info: 1,
  Hint: 0
};
