// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../../core/location';
import { Problem } from '../../core/problem';
import { ProblemCollection } from '../../core/problemCollection';
import { Severity } from '../../core/severity';
import type { ProblemTag } from '../../core/problemTag';
import type { Source } from '../../source/source';
import { createToken, createCommentToken } from '../../lexer/tokenFactory';
import { TokenKind, type Token, type CommentToken, type CommentKind } from '../../lexer/token';
import type { MacroDefinition } from '../../preproc/macroDefinition';
import type { MacroReference } from '../../preproc/macroReference';
import { MacroOccurrenceIndex } from '../../preproc/macroOccurrenceIndex';
import { PreprocessorConditionalBlock } from '../../preproc/preprocessorConditionalBlock';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import type { IncludeOccurrence, IncludeSite } from '../../preproc/includeOccurrence';
import type { SourceHighlight, SourceHighlightKind, SourceHighlightAttribute } from '../../semantic/sourceHighlight';
import { SemanticContext } from '../../semantic/semanticContext';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import {
    SemanticGraphEncoder, decodeSemanticGraphBundle,
    type SemanticGraphWire, type SemanticGraphContextEntryWire
} from './semanticGraphTransport';
import type { SourceLocationWire } from './sourceGraphTransport';

/** All IDs are local to one AnalysisResultWire; do not reuse them across jobs. */
export const ANALYSIS_RESULT_TRANSPORT_VERSION = 1 as const;

interface ProblemWire {
    readonly id: number;
    readonly location: SourceLocationWire;
    readonly message: string;
    readonly severity: string;
    readonly code?: string;
    readonly tags?: readonly ProblemTag[];
    readonly includeOccurrenceId?: string;
}
interface TokenWire {
    readonly id: number;
    readonly kind: TokenKind;
    readonly location: SourceLocationWire;
    readonly hexDigitIdentifier?: boolean;
    readonly commentKind?: CommentKind;
}
interface MacroDefinitionWire {
    readonly id: number;
    readonly name: string;
    readonly replacement: string | null;
    readonly location?: SourceLocationWire;
    readonly directiveLocation?: SourceLocationWire;
    readonly replacementLocation?: SourceLocationWire;
}
interface MacroReferenceWire {
    readonly id: number;
    readonly definition: number;
    readonly location: SourceLocationWire;
    readonly kind?: 'undef';
}
interface ConditionalWire {
    readonly ifdef: boolean;
    readonly macro: string;
    readonly macroDefinition?: number;
    readonly ifLocation: SourceLocationWire;
    readonly macroLocation: SourceLocationWire;
    readonly elseLocation?: SourceLocationWire;
    readonly endifLocation: SourceLocationWire;
    readonly conditionSatisfied: boolean;
    readonly includeOccurrenceId?: string;
}
interface HighlightWire {
    readonly element: number;
    readonly kind: SourceHighlightKind;
    readonly attributes?: readonly SourceHighlightAttribute[];
}
interface IncludeOccurrenceWire {
    readonly id: string;
    readonly sourceUri: string;
    readonly sourceId?: number;
    readonly sites: readonly IncludeSite[];
    readonly expandedSpan: { readonly start: number; readonly end: number };
}
interface AnalysisWire {
    readonly sourceId: number;
    readonly astId: number;
    readonly semantic: SemanticGraphContextEntryWire;
    readonly hasSemanticContext: boolean;
    readonly tokens: readonly number[];
    readonly problems: readonly number[];
    readonly macroReferences: readonly number[];
    readonly preprocessorConditionalBlocks: readonly ConditionalWire[];
    readonly macroDefinitions: readonly number[];
    readonly activeBlockComments: readonly number[];
    readonly sourceHighlights: readonly HighlightWire[];
}

/** Data-only boundary: safe for structuredClone and Worker.postMessage. */
export interface AnalysisResultWire {
    readonly version: typeof ANALYSIS_RESULT_TRANSPORT_VERSION;
    readonly semanticGraph: SemanticGraphWire;
    readonly analyses: readonly AnalysisWire[];
    readonly rootIndex: number;
    readonly files: readonly (readonly [string, number])[];
    readonly problemRecords: readonly ProblemWire[];
    readonly problems: readonly number[];
    readonly macroReferences: readonly number[];
    readonly macroDefinitions: readonly MacroDefinitionWire[];
    readonly references: readonly MacroReferenceWire[];
    readonly tokens: readonly TokenWire[];
    readonly includedSourceUris?: readonly string[];
    readonly includeOccurrences: readonly IncludeOccurrenceWire[];
    readonly watchedIncludeUris?: readonly string[];
}

/**
 * The canonical graph is encoded ONCE for all analyses. Each Analysis stores
 * only references to that graph, so a SourceValue used in a semantic Map and
 * a highlight (or in another Analysis) retains exact object identity.
 */
export function encodeAnalysisResult(result: AnalysisResult): AnalysisResultWire {
    rejectUnknownFields(result, ['rootAnalysis','files','problems','macroReferences',
        'includedSourceUris','includeOccurrences','watchedIncludeUris'], 'AnalysisResult');
    const semantic = new SemanticGraphEncoder();
    const sourceValues = semantic.ast.sourceValues;
    const sources = sourceValues.sources;
    const macroDefinitionIds = new Map<MacroDefinition, number>();
    const definitionRecords: MacroDefinitionWire[] = [];
    const macroReferenceIds = new Map<MacroReference, number>();
    const referenceRecords: MacroReferenceWire[] = [];
    const tokenIds = new Map<Token, number>();
    const tokenRecords: TokenWire[] = [];
    const problemIds = new Map<Problem,number>();
    const problemRecords: ProblemWire[] = [];

    const loc = (location: Location): SourceLocationWire => sources.encodeLocation(location);
    const optional = (location: Location | undefined): SourceLocationWire | undefined =>
        location === undefined ? undefined : loc(location);
    const encodeProblem = (p: Problem): number => {
        const previous = problemIds.get(p);
        if (previous !== undefined) return previous;
        rejectUnknownFields(p, ['location','message','severity','code','tags','includeOccurrenceId'], 'problem');
        const id = problemRecords.length + 1;
        problemIds.set(p,id);
        problemRecords.push({
            id, location: loc(p.location), message: p.message, severity: p.severity,
            ...(p.code === undefined ? {} : {code: p.code}),
            ...(p.tags === undefined ? {} : {tags: [...p.tags]}),
            ...(p.includeOccurrenceId === undefined ? {} : {includeOccurrenceId: p.includeOccurrenceId})
        });
        return id;
    };
    const encodeDefinition = (d: MacroDefinition): number => {
        rejectUnknownFields(d, ['name','replacement','location','directiveLocation','replacementLocation'], 'macro definition');
        const previous = macroDefinitionIds.get(d);
        if (previous !== undefined) return previous;
        const id = definitionRecords.length + 1;
        macroDefinitionIds.set(d, id);
        definitionRecords.push({
            id, name: d.name, replacement: d.replacement,
            ...(d.location === undefined ? {} : {location: loc(d.location)}),
            ...(d.directiveLocation === undefined ? {} : {directiveLocation: loc(d.directiveLocation)}),
            ...(d.replacementLocation === undefined ? {} : {replacementLocation: loc(d.replacementLocation)})
        });
        return id;
    };
    const encodeReference = (r: MacroReference): number => {
        rejectUnknownFields(r, ['definition','location','kind'], 'macro reference');
        const previous = macroReferenceIds.get(r);
        if (previous !== undefined) return previous;
        const id = referenceRecords.length + 1;
        macroReferenceIds.set(r, id);
        referenceRecords.push({id, definition: encodeDefinition(r.definition), location: loc(r.location),
            ...(r.kind === undefined ? {} : {kind: r.kind})});
        return id;
    };
    const encodeToken = (token: Token): number => {
        const previous = tokenIds.get(token);
        if (previous !== undefined) return previous;
        const id = tokenRecords.length + 1;
        tokenIds.set(token, id);
        const record: TokenWire = {
            id, kind: token.kind, location: loc(token.location),
            ...(token.hexDigitIdentifier === undefined ? {} : {hexDigitIdentifier: token.hexDigitIdentifier}),
            ...(token.kind !== TokenKind.Comment ? {} : {commentKind: (token as CommentToken).commentKind})
        };
        if (token.kind === TokenKind.Comment && record.commentKind === undefined) {
            throw new Error('Comment token without commentKind at transport boundary');
        }
        // A token must not silently gain fields that the wire format ignores.
        const allowed = token.kind === TokenKind.Comment
            ? ['kind', 'location', 'hexDigitIdentifier', 'commentKind', 'compilerOption']
            : ['kind', 'location', 'hexDigitIdentifier'];
        rejectUnknownFields(token, allowed, 'token');
        tokenRecords.push(record);
        return id;
    };
    const encodeConditional = (b: PreprocessorConditionalBlock): ConditionalWire => {
        rejectUnknownFields(b, ['ifdef','macro','macroDefinition','ifLocation','macroLocation',
            'elseLocation','endifLocation','conditionSatisfied','includeOccurrenceId'], 'conditional block');
        return {
        ifdef: b.ifdef, macro: b.macro,
        ...(b.macroDefinition === undefined ? {} : {macroDefinition: encodeDefinition(b.macroDefinition)}),
        ifLocation: loc(b.ifLocation), macroLocation: loc(b.macroLocation),
        ...(b.elseLocation === undefined ? {} : {elseLocation: loc(b.elseLocation)}),
        endifLocation: loc(b.endifLocation), conditionSatisfied: b.conditionSatisfied,
        ...(b.includeOccurrenceId === undefined ? {} : {includeOccurrenceId: b.includeOccurrenceId})
        };
    };
    const encodeHighlight = (h: SourceHighlight): HighlightWire => {
        rejectUnknownFields(h, ['element','kind','attributes'], 'source highlight');
        return {element: sourceValues.encode(h.element), kind: h.kind,
            ...(h.attributes === undefined ? {} : {attributes: [...h.attributes]})};
    };
    const encodeOccurrence = (o: IncludeOccurrence): IncludeOccurrenceWire => {
        rejectUnknownFields(o, ['id','sourceUri','source','sites','expandedSpan'], 'include occurrence');
        for (const site of o.sites) {
            rejectUnknownFields(site, ['includingUri','directiveOffset','includedUri'], 'include site');
        }
        return {
            id: o.id, sourceUri: o.sourceUri,
            ...(o.source === undefined ? {} : {sourceId: sources.encodeSource(o.source)}),
            sites: o.sites.map(site => ({...site})),
            expandedSpan: {...o.expandedSpan}
        };
    };

    const analyses = [...new Set([result.rootAnalysis, ...result.files.values()])];
    const indices = new Map(analyses.map((analysis, index) => [analysis, index]));
    const records: AnalysisWire[] = [];
    // Auxiliary fields must be registered before the last semanticGraph.finish().
    const additions = analyses.map(analysis => {
        rejectUnknownFields(analysis, ['source','tokens','ast','problems','macroReferences',
            'preprocessorConditionalBlocks','semanticContext','symbolReferences',
            'symbolReferenceResolutions','symbolOccurrences','macroDefinitions','macroOccurrences',
            'activeBlockComments','sourceHighlights','cachedCallSignatureIndex',
            'cachedCallSignatureHelp','cachedBlockComments'], 'Analysis');
        return {
        sourceId: sources.encodeSource(analysis.source),
        tokens: analysis.tokens.map(encodeToken),
        problems: [...analysis.problems].map(encodeProblem),
        macroReferences: analysis.macroReferences.map(encodeReference),
        blocks: [...analysis.preprocessorConditionalBlocks].map(encodeConditional),
        definitions: analysis.macroDefinitions.map(encodeDefinition),
        comments: analysis.activeBlockComments.map(encodeToken),
        highlights: analysis.sourceHighlights.map(encodeHighlight)
        };
    });
    const allProblems = [...result.problems].map(encodeProblem);
    const allReferences = result.macroReferences.map(encodeReference);
    const occurrences = result.includeOccurrences.map(encodeOccurrence);

    let graph: SemanticGraphWire | undefined;
    for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i]!;
        const extra = additions[i]!;
        graph = semantic.encode(
            analysis.ast, analysis.semanticContext ?? new SemanticContext(),
            analyses.map(a => a.source),
            {references: analysis.symbolReferences, resolutions: analysis.symbolReferenceResolutions}
        );
        records.push({
            sourceId: extra.sourceId,
            astId: semantic.ast.encode(analysis.ast),
            semantic: {context: graph.context, ...(graph.indices === undefined ? {} : {indices: graph.indices})},
            hasSemanticContext: analysis.semanticContext !== undefined,
            tokens: extra.tokens, problems: extra.problems,
            macroReferences: extra.macroReferences,
            preprocessorConditionalBlocks: extra.blocks,
            macroDefinitions: extra.definitions,
            activeBlockComments: extra.comments,
            sourceHighlights: extra.highlights
        });
    }
    if (!graph) throw new Error('AnalysisResult must contain a root analysis');
    const files = [...result.files].map(([uri, analysis]): readonly [string,number] => {
        const index = indices.get(analysis);
        if (index === undefined) throw new Error(`Unregistered file analysis: ${uri}`);
        return [uri, index];
    });
    return {
        version: ANALYSIS_RESULT_TRANSPORT_VERSION,
        semanticGraph: graph, analyses: records,
        rootIndex: indices.get(result.rootAnalysis)!,
        files, problemRecords, problems: allProblems, macroReferences: allReferences,
        macroDefinitions: definitionRecords, references: referenceRecords,
        tokens: tokenRecords,
        ...(result.includedSourceUris === undefined ? {} : {includedSourceUris: [...result.includedSourceUris]}),
        includeOccurrences: occurrences,
        ...(result.watchedIncludeUris === undefined ? {} : {watchedIncludeUris: [...result.watchedIncludeUris]})
    };
}

/** Materialize real compiler classes and shared object references, never patch prototypes. */
export function decodeAnalysisResult(wire: AnalysisResultWire): AnalysisResult {
    if (wire.version !== ANALYSIS_RESULT_TRANSPORT_VERSION ||
        !Array.isArray(wire.analyses) || !wire.analyses.length ||
        !Array.isArray(wire.files) || !Array.isArray(wire.macroDefinitions) ||
        !Array.isArray(wire.references) || !Array.isArray(wire.tokens) ||
        !Array.isArray(wire.includeOccurrences) || !Array.isArray(wire.problemRecords) ||
        !Array.isArray(wire.problems) ||
        !Array.isArray(wire.macroReferences)) {
        throw new Error('Unsupported or malformed AnalysisResult transport version');
    }
    const decoded = decodeSemanticGraphBundle(wire.semanticGraph, wire.analyses.map(a => a.semantic));
    const sourceGraph = decoded.ast.sourceValues.sources;
    const sourceValues = decoded.ast.sourceValues;
    const location = (l: SourceLocationWire): Location => sourceGraph.decodeLocation(l);
    const resolveSource = (id: number): Source => sourceGraph.resolve(id);
    const definitions = decodeUniqueRecords(wire.macroDefinitions, 'macro definition', record => ({
        name: record.name, replacement: record.replacement,
        ...(record.location === undefined ? {} : {location: location(record.location)}),
        ...(record.directiveLocation === undefined ? {} : {directiveLocation: location(record.directiveLocation)}),
        ...(record.replacementLocation === undefined ? {} : {replacementLocation: location(record.replacementLocation)})
    } as MacroDefinition));
    const references = decodeUniqueRecords(wire.references, 'macro reference', record => ({
        definition: resolve(definitions, record.definition, 'macro definition'),
        location: location(record.location),
        ...(record.kind === undefined ? {} : {kind: record.kind})
    } as MacroReference));
    const tokens = decodeUniqueRecords(wire.tokens, 'token', record => {
        const loc = location(record.location);
        if (record.kind === TokenKind.Comment) {
            if (record.commentKind === undefined) throw new Error('Comment token without commentKind');
            if (record.hexDigitIdentifier) throw new Error('Comment token cannot be a hexadecimal identifier');
            return createCommentToken(loc, record.commentKind);
        }
        if (record.commentKind !== undefined) throw new Error('Non-comment token has commentKind');
        return createToken(record.kind, loc, record.hexDigitIdentifier);
    });
    const decodeProblem = (problem: ProblemWire): Problem => {
        const options = {
            ...(problem.code === undefined ? {} : {code: problem.code}),
            ...(problem.tags === undefined ? {} : {tags: [...problem.tags]}),
            ...(problem.includeOccurrenceId === undefined ? {} : {includeOccurrenceId: problem.includeOccurrenceId})
        };
        const at = location(problem.location);
        switch (problem.severity) {
            case Severity.Error: return Problem.error(at, problem.message, options);
            case Severity.Warning: return Problem.warning(at, problem.message, options);
            case Severity.Info: return Problem.info(at, problem.message, options);
            case Severity.Hint: return Problem.hint(at, problem.message, options);
            default: throw new Error(`Unsupported problem severity: ${problem.severity}`);
        }
    };
    const decodedProblems = decodeUniqueRecords(wire.problemRecords,'problem',decodeProblem);
    const collection = (problemIds: readonly number[]): ProblemCollection => {
        const result = new ProblemCollection();
        for (const id of problemIds) result.add(resolve(decodedProblems,id,'problem'));
        return result;
    };
    const decodeConditional = (block: ConditionalWire): PreprocessorConditionalBlock => new PreprocessorConditionalBlock(
        block.ifdef, block.macro,
        block.macroDefinition === undefined ? undefined : resolve(definitions, block.macroDefinition, 'macro definition'),
        location(block.ifLocation), location(block.macroLocation),
        block.elseLocation === undefined ? undefined : location(block.elseLocation),
        location(block.endifLocation), block.conditionSatisfied, block.includeOccurrenceId
    );
    const decodedAnalyses = wire.analyses.map((a: AnalysisWire, index: number) => {
        const blocks = new PreprocessorConditionalBlockCollection();
        for (const block of a.preprocessorConditionalBlocks) blocks.add(decodeConditional(block));
        const refs = a.macroReferences.map((id: number) => resolve(references,id,'macro reference'));
        const defs = a.macroDefinitions.map((id: number) => resolve(definitions,id,'macro definition'));
        const entry = decoded.entries[index]!;
        if (!entry.references || !entry.resolutions || !entry.occurrences) {
            throw new Error(`Missing semantic indices for analysis ${index}`);
        }
        const comments = a.activeBlockComments.map((id: number) => {
            const token = resolve(tokens,id,'token');
            if (token.kind !== TokenKind.Comment) throw new Error('Active block comment references non-comment token');
            return token as CommentToken;
        });
        const highlights = a.sourceHighlights.map((h: HighlightWire): SourceHighlight => ({
            element: sourceValues.resolve(h.element), kind: h.kind,
            ...(h.attributes === undefined ? {} : {attributes: [...h.attributes]})
        }));
        return new Analysis(
            resolveSource(a.sourceId), a.tokens.map((id: number) => resolve(tokens,id,'token')),
            decoded.ast.resolve(a.astId), collection(a.problems), refs, blocks,
            a.hasSemanticContext ? entry.context : undefined,
            entry.references, entry.resolutions, entry.occurrences,
            defs, new MacroOccurrenceIndex(defs,refs), comments, highlights
        );
    });
    const root = resolve(decodedAnalyses,wire.rootIndex,'root analysis');
    const files = new Map<string,Analysis>();
    for (const [uri,id] of wire.files) {
        if (files.has(uri)) throw new Error(`Duplicate AnalysisResult file URI: ${uri}`);
        const analysis = resolve(decodedAnalyses,id,'file analysis');
        if (analysis.source.uri !== uri) throw new Error(`AnalysisResult file URI mismatch: ${uri}`);
        files.set(uri,analysis);
    }
    const occurrences: IncludeOccurrence[] = wire.includeOccurrences.map(o => ({
        id:o.id, sourceUri:o.sourceUri,
        ...(o.sourceId === undefined ? {} : {source:resolveSource(o.sourceId)}),
        sites:o.sites.map((s: IncludeSite) => ({...s})), expandedSpan:{...o.expandedSpan}
    }));
    return AnalysisResult.rehydrate(
        root, files, collection(wire.problems),
        wire.macroReferences.map((id: number) => resolve(references,id,'macro reference')),
        wire.includedSourceUris, occurrences, wire.watchedIncludeUris
    );
}

function rejectUnknownFields(value: object, fields: readonly string[], label: string): void {
    const allowed = new Set(fields);
    for (const field of Object.keys(value)) {
        if (!allowed.has(field)) throw new Error(`Unsupported ${label} field at transport boundary: ${field}`);
    }
}
function decodeUniqueRecords<T extends {readonly id: number}, V>(
    records: readonly T[], label: string, decode: (record: T) => V
): Map<number,V> {
    const result = new Map<number,V>();
    for (const record of records) {
        if (!Number.isSafeInteger(record.id) || record.id < 1 || result.has(record.id)) {
            throw new Error(`Invalid or duplicate ${label} identity: ${record.id}`);
        }
        result.set(record.id,decode(record));
    }
    return result;
}
function resolve<T>(items: ReadonlyMap<number,T> | readonly T[], id: number, label: string): T {
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`Invalid ${label} identity: ${id}`);
    const result = Array.isArray(items) ? items[id] : (items as ReadonlyMap<number,T>).get(id);
    if (result === undefined) throw new Error(`Missing ${label} identity: ${id}`);
    return result;
}
