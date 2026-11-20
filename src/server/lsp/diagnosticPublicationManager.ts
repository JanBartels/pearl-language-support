// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Diagnostic } from 'vscode-languageserver/node';

interface UnitDiagnostics {
    /** Source files participating in this translation unit. */
    readonly sources: ReadonlySet<string>;
    /** A missing entry means that this source has no diagnostics in this unit. */
    readonly diagnostics: ReadonlyMap<string, readonly Diagnostic[]>;
}

/**
 * LSP-side owner of published diagnostics.
 *
 * Diagnostics belong to a translation unit, not to the most recently
 * analyzed document. Publishing one unit must never clear diagnostics owned
 * by another unit.
 *
 * If a source participates in several units, exactly one unit is selected
 * for publishing its diagnostics. The initial choice remains stable until
 * that unit disappears the unit is no longer an owner. Later workspace support may
 * provide explicit context selection.
 * No diagnostics from different macro/semantic contexts are merged.
 */
export class DiagnosticPublicationManager {
    private readonly units = new Map<string, UnitDiagnostics>();
    private readonly selectedUnitBySource = new Map<string, string>();

    constructor(
        private readonly send: (uri: string, diagnostics: Diagnostic[]) => void
    ) {}

    /** Replace one unit's complete diagnostic result. */
    publish(
        unitUri: string,
        diagnostics: ReadonlyMap<string, readonly Diagnostic[]>,
        sourceUris: Iterable<string> = []
    ): void {
        const previous = this.units.get(unitUri);
        const sources = new Set<string>([unitUri, ...sourceUris]);
        const snapshot = new Map<string, readonly Diagnostic[]>();

        for (const [uri, items] of diagnostics) {
            sources.add(uri);
            snapshot.set(uri, [...items]);
        }

        this.units.set(unitUri, { sources, diagnostics: snapshot });

        // The previous result may contain a source which is no longer included.
        const affected = new Set<string>([...(previous?.sources ?? []), ...sources]);
        for (const sourceUri of affected) {
            this.refreshSource(sourceUri, unitUri);
        }
    }

    /** Remove a translation unit, retaining contributions from other units. */
    removeUnit(unitUri: string): void {
        const previous = this.units.get(unitUri);
        if (!previous) return;

        this.units.delete(unitUri);
        for (const sourceUri of previous.sources) {
            this.refreshSource(sourceUri);
        }
    }

    private refreshSource(sourceUri: string, updatedUnitUri?: string): void {
        const previousSelection = this.selectedUnitBySource.get(sourceUri);
        let selectedUnit: string | undefined;

        if (previousSelection && this.units.get(previousSelection)?.sources.has(sourceUri)) {
            selectedUnit = previousSelection;
        } else {
            for (const [uri, unit] of this.units) {
                if (unit.sources.has(sourceUri)) {
                    selectedUnit = uri;
                    break;
                }
            }
        }

        if (!selectedUnit) {
            if (previousSelection !== undefined) {
                this.selectedUnitBySource.delete(sourceUri);
                this.send(sourceUri, []);
            }
            return;
        }

        // A different unit's analysis has no effect on the visible context.
        if (selectedUnit !== previousSelection || selectedUnit === updatedUnitUri) {
            this.selectedUnitBySource.set(sourceUri, selectedUnit);
            const items = this.units.get(selectedUnit)!.diagnostics.get(sourceUri) ?? [];
            this.send(sourceUri, [...items]);
        }
    }
}
