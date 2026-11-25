// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { IncludeContextUiState } from '../shared/includeContextUiProtocol';

export interface IncludeContextStatusPresentation {
  readonly text: string;
  readonly tooltip: string;
  readonly canChoose: boolean;
}

/** No client-side selection: derive the status exclusively from the server reply. */
export function presentIncludeContextStatus(
  state: IncludeContextUiState
): IncludeContextStatusPresentation | null {
  const { options, knownIncluded, selectedIndex } = state;
  if (!knownIncluded && options.length === 0) return null;
  if (options.length === 0) return {
    text: '$(layers) PEARL: Kontext wird analysiert',
    tooltip: 'PEARL-Include: Die Analysekontexte sind noch nicht verfügbar.',
    canChoose: false
  };
  if (selectedIndex === null || !options[selectedIndex]) return {
    text: `$(layers) PEARL: Kontext wählen (${options.length})`,
    tooltip: `${options.length} Include-Kontexte verfügbar. Klicken, um einen Kontext auszuwählen.`,
    canChoose: options.length > 1
  };
  const selected = options[selectedIndex];
  return {
    text: `$(layers) ${selected.unitName} (${selectedIndex + 1}/${options.length})`,
    tooltip: `PEARL-Include-Kontext: ${selected.label}` +
      (options.length > 1 ? '\nKlicken, um den Kontext zu wechseln.' : ''),
    canChoose: options.length > 1
  };
}

/** The numeric prefix and object identity distinguish even identically named sites. */
export function includeContextQuickPickItems(state: IncludeContextUiState): Array<{
  label: string;
  description: string;
  picked: boolean;
  optionIndex: number;
}> {
  return state.options.map((option, optionIndex) => ({
    label: optionIndex === state.selectedIndex
      ? `$(check) ${optionIndex + 1}. ${option.unitName}`
      : `${optionIndex + 1}. ${option.unitName}`,
    description: option.label,
    picked: optionIndex === state.selectedIndex,
    optionIndex
  }));
}

/** Ignore out-of-order replies if the user changes editors or refreshes again. */
export class IncludeContextRequestGate {
  private generation = 0;

  cancel(): void {
    this.generation++;
  }

  async read(
    uri: string,
    fetch: (uri: string) => Promise<IncludeContextUiState | null>
  ): Promise<IncludeContextUiState | null> {
    const generation = ++this.generation;
    const state = await fetch(uri);
    return generation === this.generation && state?.uri === uri ? state : null;
  }
}
