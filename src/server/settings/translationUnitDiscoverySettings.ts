// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** Fallback preserves the pre-0.3.4 non-recursive discovery behavior. */
export const defaultTranslationUnitDiscoveryDepth = 0;

/**
 * VS Code validates the contributed setting, but older/mismatched clients may
 * return absent or malformed configuration values. Never scan deeper by accident.
 */
export function normalizeTranslationUnitDiscoveryDepth(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : defaultTranslationUnitDiscoveryDepth;
}
