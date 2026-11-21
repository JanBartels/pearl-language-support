// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DiagnosticSeverity, DiagnosticTag, type Diagnostic } from 'vscode-languageserver/node';
import type { IncludeOccurrence } from '../preproc/includeOccurrence';
import type { MappedDiagnostic } from './diagnosticMapper';

interface UnitDiagnostics {
    /** Source files participating in this translation unit. */
    readonly sources: ReadonlySet<string>;
    /** A missing entry means that this source has no diagnostics in this unit. */
    readonly diagnostics: ReadonlyMap<string, readonly MappedDiagnostic[]>;
    readonly occurrences: ReadonlyMap<string, ReadonlySet<string>>;
    readonly occurrenceOrder: ReadonlyMap<string, readonly string[]>;
}

interface DiagnosticContribution {
    readonly diagnostic: MappedDiagnostic;
    readonly unitUri: string;
    readonly occurrenceId?: string;
}

/**
 * LSP-side owner of diagnostics, independently of editor include selection.
 *
 * Every translation unit is analyzed and its diagnostics retained. For a
 * multiply included source, a non-selected editor receives a project-wide
 * overview instead of an arbitrary interpretation. Errors remain visible in
 * that overview even after an include context is selected; context-specific
 * warnings and hints follow the selected execution. This is a deliberate
 * compromise of LSP's single publishDiagnostics list per physical URI.
 *
 * The independent compiler results are never combined into one semantic
 * analysis. Only the resulting diagnostics are assembled for publication.
 */
export class DiagnosticPublicationManager {
    private readonly units = new Map<string, UnitDiagnostics>();
    private readonly selectedUnitBySource = new Map<string, string>();
    /** Separate explicit user choice from an automatically inferred sole owner. */
    private readonly explicitSelections = new Set<string>();
    private readonly selectedOccurrenceBySource = new Map<string, string>();
    private readonly lastSent = new Map<string, readonly Diagnostic[]>();

    constructor(
        private readonly send: (uri: string, diagnostics: Diagnostic[]) => void
    ) {}

    /** Replace one unit's complete diagnostic result. */
    publish(
        unitUri: string,
        diagnostics: ReadonlyMap<string, readonly MappedDiagnostic[]>,
        sourceUris: Iterable<string> = [],
        includeOccurrences: readonly IncludeOccurrence[] = []
    ): void {
        const previous = this.units.get(unitUri);
        const sources = new Set<string>([unitUri, ...sourceUris]);
        const snapshot = new Map<string, readonly MappedDiagnostic[]>();
        const occurrences = new Map<string, Set<string>>();
        const occurrenceOrder = new Map<string, string[]>();
        for (const occurrence of includeOccurrences) {
            let ids = occurrences.get(occurrence.sourceUri);
            if (!ids) {
                ids = new Set<string>();
                occurrences.set(occurrence.sourceUri, ids);
                occurrenceOrder.set(occurrence.sourceUri, []);
            }
            if (!ids.has(occurrence.id)) {
                ids.add(occurrence.id);
                occurrenceOrder.get(occurrence.sourceUri)!.push(occurrence.id);
            }
        }
        for (const [uri, items] of diagnostics) {
            sources.add(uri);
            snapshot.set(uri, [...items]);
        }
        this.units.set(unitUri, { sources, diagnostics: snapshot, occurrences, occurrenceOrder });

        // A removed include is still affected, even if no current unit owns it.
        const affected = new Set<string>([...(previous?.sources ?? []), ...sources]);
        for (const sourceUri of affected) {
            this.refreshSource(sourceUri, unitUri);
        }
    }

    /** Select the editor's execution, without suppressing other units' errors. */
    selectContext(sourceUri: string, unitUri: string, occurrenceId?: string): boolean {
        const unit = this.units.get(unitUri);
        if (!unit?.sources.has(sourceUri)) return false;
        if (occurrenceId !== undefined && !unit.occurrences.get(sourceUri)?.has(occurrenceId)) {
            return false;
        }
        this.selectedUnitBySource.set(sourceUri, unitUri);
        this.explicitSelections.add(sourceUri);
        if (occurrenceId === undefined) this.selectedOccurrenceBySource.delete(sourceUri);
        else this.selectedOccurrenceBySource.set(sourceUri, occurrenceId);
        this.publishForSource(sourceUri, this.visibleDiagnostics(sourceUri, unitUri), true);
        return true;
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

    /** Diagnostics belonging to the selected execution, without LSP-private fields. */
    private visibleDiagnostics(sourceUri: string, unitUri: string): Diagnostic[] {
        const unit = this.units.get(unitUri)!;
        const occurrenceIds = unit.occurrences.get(sourceUri);
        const preferred = this.selectedOccurrenceBySource.get(sourceUri);
        const currentOccurrence = preferred !== undefined
            ? (occurrenceIds?.has(preferred) ? preferred : undefined)
            : occurrenceIds?.size === 1 ? [...occurrenceIds][0] : undefined;
        return (unit.diagnostics.get(sourceUri) ?? [])
            .filter(diagnostic => diagnostic.includeOccurrenceId === undefined
                || diagnostic.includeOccurrenceId === currentOccurrence)
            .map(({ includeOccurrenceId: _unused, ...diagnostic }) => diagnostic);
    }

    /**
     * Project-wide diagnostics before an explicit choice. Inactive-region
     * hints are intentionally excluded: merging them would dim code which is
     * active in another execution. All real problems remain visible.
     */
    private overviewDiagnostics(sourceUri: string): Diagnostic[] {
        return this.collectAcrossUnits(sourceUri, () => true);
    }

    private collectAcrossUnits(
        sourceUri: string,
        accept: (contribution: DiagnosticContribution) => boolean
    ): Diagnostic[] {
        const contributions: DiagnosticContribution[] = [];
        for (const [unitUri, unit] of this.units) {
            for (const diagnostic of unit.diagnostics.get(sourceUri) ?? []) {
                // Inactivity markers must never dim a physical header in the
                // project overview. Actual warnings tagged Unnecessary are
                // still useful there, but without that visual dimming tag.
                if (diagnostic.severity === DiagnosticSeverity.Hint
                    && diagnostic.tags?.includes(DiagnosticTag.Unnecessary)) continue;
                const contribution = { diagnostic, unitUri, occurrenceId: diagnostic.includeOccurrenceId };
                if (accept(contribution)) contributions.push(contribution);
            }
        }
        const multipleContexts = this.contextCount(sourceUri) > 1;
        const groups = new Map<string, { diagnostic: Diagnostic; origins: Set<string> }>();
        for (const contribution of contributions) {
            const { includeOccurrenceId: _unused, ...unscoped } = contribution.diagnostic;
            let plain: Diagnostic = unscoped;
            if (unscoped.tags?.includes(DiagnosticTag.Unnecessary)) {
                const { tags: _unusedTags, ...withoutTags } = unscoped;
                const remaining = unscoped.tags.filter(t => t !== DiagnosticTag.Unnecessary);
                plain = remaining.length ? { ...withoutTags, tags: remaining } : withoutTags;
            }
            const key = JSON.stringify(plain);
            let group = groups.get(key);
            if (!group) {
                group = { diagnostic: plain, origins: new Set<string>() };
                groups.set(key, group);
            }
            group.origins.add(this.originLabel(sourceUri, contribution));
        }
        return [...groups.values()].map(({ diagnostic, origins }) =>
            multipleContexts
                ? { ...diagnostic, message: `[${[...origins].join(', ')}] ${diagnostic.message}` }
                : diagnostic
        );
    }

    private contextCount(sourceUri: string): number {
        let count = 0;
        for (const unit of this.units.values()) {
            if (unit.sources.has(sourceUri)) {
                count += unit.occurrences.get(sourceUri)?.size || 1;
            }
        }
        return count;
    }

    private originLabel(sourceUri: string, contribution: DiagnosticContribution): string {
        const unit = this.units.get(contribution.unitUri)!;
        const baseName = decodeURIComponent(contribution.unitUri.split('/').at(-1) ?? contribution.unitUri);
        // Different directories may contain .P files with the same basename.
        const duplicatedName = [...this.units.keys()].some(uri => uri !== contribution.unitUri
            && decodeURIComponent(uri.split('/').at(-1) ?? uri) === baseName);
        const unitName = duplicatedName ? contribution.unitUri : baseName;
        const order = unit.occurrenceOrder.get(sourceUri);
        if (!contribution.occurrenceId || !order || order.length < 2) return unitName;
        const index = order.indexOf(contribution.occurrenceId);
        return index < 0 ? unitName : `${unitName}, Include ${index + 1}`;
    }

    private refreshSource(sourceUri: string, updatedUnitUri?: string): void {
        const previousSelection = this.selectedUnitBySource.get(sourceUri);
        let selectedUnit: string | undefined;

        // A user-selected execution remains authoritative while it exists.
        if (this.explicitSelections.has(sourceUri)) {
            const unit = previousSelection && this.units.get(previousSelection);
            const preferred = this.selectedOccurrenceBySource.get(sourceUri);
            if (unit?.sources.has(sourceUri)
                && (preferred === undefined || unit.occurrences.get(sourceUri)?.has(preferred))) {
                selectedUnit = previousSelection;
            } else {
                this.explicitSelections.delete(sourceUri);
                this.selectedOccurrenceBySource.delete(sourceUri);
            }
        }
        if (!selectedUnit) {
            // A root's own translation unit takes precedence over a parent
            // which happens to include that same .P file.
            if (this.units.get(sourceUri)?.sources.has(sourceUri)) {
                selectedUnit = sourceUri;
            } else if (this.contextCount(sourceUri) === 1) {
                selectedUnit = [...this.units].find(([, unit]) => unit.sources.has(sourceUri))?.[0];
            }
        }
        if (!selectedUnit) {
            this.selectedUnitBySource.delete(sourceUri);
            this.selectedOccurrenceBySource.delete(sourceUri);
            this.publishForSource(sourceUri, this.overviewDiagnostics(sourceUri));
            return;
        }
        if (selectedUnit !== previousSelection) {
            this.selectedOccurrenceBySource.delete(sourceUri);
        }
        this.selectedUnitBySource.set(sourceUri, selectedUnit);
        this.publishForSource(sourceUri, this.visibleDiagnostics(sourceUri, selectedUnit),
            selectedUnit === updatedUnitUri || selectedUnit !== previousSelection);
    }

    private publishForSource(sourceUri: string, selectedDiagnostics: Diagnostic[], force = false): void {
        const unitUri = this.selectedUnitBySource.get(sourceUri);
        const combined = unitUri
            ? this.combineSelectedWithProjectErrors(sourceUri, selectedDiagnostics)
            : selectedDiagnostics;
        const last = this.lastSent.get(sourceUri);
        if (!force && last !== undefined && JSON.stringify(last) === JSON.stringify(combined)) return;
        // Closing a workspace must not retain diagnostics for files which are
        // no longer part of any translation unit.
        const stillOwned = [...this.units.values()].some(unit => unit.sources.has(sourceUri));
        if (!stillOwned && combined.length === 0) this.lastSent.delete(sourceUri);
        else this.lastSent.set(sourceUri, combined);
        this.send(sourceUri, combined);
    }

    /**
     * Publish every compiler error exactly once, irrespective of the editor's
     * selected execution. The project-wide collector groups identical errors
     * (including those also visible in the selected execution) and preserves
     * their origin labels. Only warnings, information and hints come from the
     * selected execution. Appending the old 'other errors' list to the raw
     * selected diagnostics produced duplicates with different message prefixes.
     */
    private combineSelectedWithProjectErrors(
        sourceUri: string, selectedDiagnostics: Diagnostic[]
    ): Diagnostic[] {
        const projectErrors = this.collectAcrossUnits(sourceUri,
            contribution => contribution.diagnostic.severity === DiagnosticSeverity.Error);
        const selectedNonErrors = selectedDiagnostics.filter(
            diagnostic => diagnostic.severity !== DiagnosticSeverity.Error);
        return [...projectErrors, ...selectedNonErrors];
    }
}
