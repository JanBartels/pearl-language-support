// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** Read-only UI projection of the registry's include-occurrence selection. */
export interface IncludeContextUiOption {
  readonly unitUri: string;
  readonly occurrenceId: string | null;
  /** Short, human-readable name of the owning translation unit. */
  readonly unitName: string;
  /** Full include directive chain, for the filterable picker and tooltip. */
  readonly label: string;
}

export interface IncludeContextUiState {
  readonly uri: string;
  readonly version: number;
  readonly knownIncluded: boolean;
  readonly options: readonly IncludeContextUiOption[];
  /** Index into options; null means no valid selection, never an implicit first. */
  readonly selectedIndex: number | null;
}

export interface SelectIncludeContextUiRequest {
  readonly uri: string;
  readonly version: number;
  readonly unitUri: string;
  readonly occurrenceId: string | null;
}
