// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { IncludeContextOption } from '../utility/documentRegistry';
import type { IncludeContextUiState } from '../../shared/includeContextUiProtocol';

/** Read-only boundary adapter; registry and occurrence identities stay authoritative. */
export function buildIncludeContextUiState(
  uri: string,
  version: number,
  knownIncluded: boolean,
  options: readonly IncludeContextOption[],
  selected: IncludeContextOption | undefined,
  unitName: (unitUri: string) => string,
  describe: (option: IncludeContextOption) => string
): IncludeContextUiState {
  const selectedIndex = selected ? options.findIndex(option =>
    option.unitUri === selected.unitUri
    && option.occurrence?.id === selected.occurrence?.id) : -1;
  return {
    uri,
    version,
    knownIncluded: knownIncluded || options.length > 0,
    options: options.map(option => ({
      unitUri: option.unitUri,
      occurrenceId: option.occurrence?.id ?? null,
      unitName: unitName(option.unitUri),
      label: describe(option)
    })),
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null
  };
}
