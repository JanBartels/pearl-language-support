// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';
import { Validator } from '../../validation/validator';
import type { AnalysisResult } from '../../validation/analysisResult';
import { defaultSettings } from '../../settings/pearlSettings';
import { DocumentRegistry } from '../../utility/documentRegistry';
import type { WorkspaceManager } from '../../utility/workspace';
import type { Logger } from '../../utility/logging/logger';
import { encodeAnalysisResult, decodeAnalysisResult } from '../../utility/transport/analysisResultTransport';
import { AstLookupResultDocumentationProvider } from '../../documentation/astLookupResultDocumentationProvider';
import { PreprocessorConditionalBlockLookup } from '../../preproc/preprocessorConditionalBlockLookup';
import { PreprocessorConditionalBlockDocumentationProvider } from '../../documentation/preprocessorConditionalBlockDocumentationProvider';
import { MacroDocumentationProvider } from '../../documentation/macroDocumentationProvider';
import { createHover } from '../createHover';
import { lookupSymbolDefinition } from '../../semantic/bindingIndex';
import { mapLspLocation } from '../lspLocationMapper';
import { findReferences } from '../findReferences';
import { findMacroReferences } from '../findMacroReferences';
import { mapDiagnostics } from '../diagnosticMapper';
import { DiagnosticPublicationManager } from '../diagnosticPublicationManager';
import { createFoldingRangesForDocument } from '../createFoldingRangesForDocument';
import { createSignatureHelp } from '../createSignatureHelp';
import { SemanticTokenService } from '../../semanticTokens/semanticTokenService';
import { TokenLegend } from '../../semanticTokens/tokenLegend';

const base = 'file:///parity/';
const firstUri = base + 'First.P';
const secondUri = base + 'Second.P';
const headerUri = base + 'Shared.inc';
const firstText = `MODULE First;
PROBLEM;
#include "Shared.inc"
#include "Shared.inc"
P: PROC;
  DCL Local FIXED;
  Local := 1;
  Local := Local + 1;
END;
MODEND;`;
const secondText = `MODULE Second;
PROBLEM;
#include "Shared.inc"
Q: PROC;
  DCL Other FIXED;
  Other := 2;
END;
MODEND;`;
const headerText = `#ifndef SHARED_GUARD
#define SHARED_GUARD
DCL Shared FIXED;
#endif
`;
const quiet: Logger = { info() {}, warn() {}, error() {} };

/** Real registry state, with deterministic in-memory editor documents and includes. */
class MemoryRegistry extends DocumentRegistry {
    constructor(readonly files: ReadonlyMap<string, TextDocument>) {
        super({ get: (uri: string) => files.get(uri) } as TextDocuments<TextDocument>);
    }

    override get(uri: string): TextDocument | null {
        return this.files.get(uri) ?? null;
    }
}

function makeDocuments(): Map<string, TextDocument> {
    return new Map([
        [firstUri, TextDocument.create(firstUri, 'pearl', 1, firstText)],
        [secondUri, TextDocument.create(secondUri, 'pearl', 1, secondText)],
        [headerUri, TextDocument.create(headerUri, 'pearl', 1, headerText)]
    ]);
}

type ResultPair = Readonly<{
    original: readonly [AnalysisResult, AnalysisResult];
    restored: readonly [AnalysisResult, AnalysisResult];
}>;

let resultPromise: Promise<ResultPair> | undefined;
function results(): Promise<ResultPair> {
    resultPromise ??= (async () => {
        const docs = makeDocuments();
        const registry = new MemoryRegistry(docs);
        const validator = new Validator({} as WorkspaceManager, registry, quiet);
        const first = await validator.analyze(docs.get(firstUri)!, defaultSettings);
        const second = await validator.analyze(docs.get(secondUri)!, defaultSettings);
        const transport = (result: AnalysisResult) =>
            decodeAnalysisResult(structuredClone(encodeAnalysisResult(result)));
        const restoredFirst = transport(first);
        const restoredSecond = transport(second);
        assert.notEqual(restoredFirst, first);
        assert.notEqual(restoredFirst.rootAnalysis.ast, first.rootAnalysis.ast);
        return { original: [first, second], restored: [restoredFirst, restoredSecond] };
    })();
    return resultPromise;
}

function harness(pair: readonly [AnalysisResult, AnalysisResult]) {
    const docs = makeDocuments();
    const registry = new MemoryRegistry(docs);
    for (const [index, uri] of [firstUri, secondUri].entries()) {
        registry.beginAnalysis(uri);
        registry.setAnalysisResult(uri, docs.get(uri)!.version, pair[index]!);
    }
    return { docs, registry, first: pair[0], second: pair[1] };
}

function cursor(document: TextDocument, text: string, needle: string, from = 0) {
    const index = text.indexOf(needle, from);
    assert.ok(index >= 0, `Missing fixture token ${needle}`);
    return document.positionAt(index);
}

/** Same compiler lookup and documentation provider used by the Hover handler. */
function astHover(result: AnalysisResult, uri: string, offset: number) {
    const analysis = result.rootAnalysis;
    const lookup = analysis.ast.lookupSourceValue({ uri, offset });
    assert.ok(lookup, `AST lookup missing for ${uri}@${offset}`);
    const markdown = AstLookupResultDocumentationProvider.getDocumentation(
        lookup, analysis.semanticContext, analysis.callSignatures
    );
    assert.ok(markdown, `Hover documentation missing for ${uri}@${offset}`);
    return createHover(markdown);
}

function definition(result: AnalysisResult, registry: DocumentRegistry, uri: string, offset: number) {
    const lookup = result.rootAnalysis.ast.lookupSourceValue({ uri, offset });
    assert.ok(lookup, `Definition AST lookup missing for ${uri}@${offset}`);
    const semantic = result.rootAnalysis.semanticContext;
    assert.ok(semantic, 'Missing semantic context');
    const target = lookupSymbolDefinition(semantic.bindings, lookup.element);
    assert.ok(target?.location, `Missing bound definition for ${String(lookup.element.value)}`);
    const mapped = mapLspLocation(target.location, registry);
    assert.ok(mapped, 'Missing physical definition target');
    return mapped;
}

function diagnostics(pair: readonly [AnalysisResult, AnalysisResult]) {
    const { registry } = harness(pair);
    const emitted: { uri: string; diagnostics: unknown[] }[] = [];
    const publisher = new DiagnosticPublicationManager((uri, values) =>
        emitted.push({ uri, diagnostics: values })
    );
    for (const [index, uri] of [firstUri, secondUri].entries()) {
        const result = pair[index]!;
        publisher.publish(uri, mapDiagnostics(result.problems, registry),
            [...result.files.keys(), ...(result.includedSourceUris ?? [])], result.includeOccurrences);
    }
    const overview = structuredClone(emitted);
    const options = registry.getIncludeContextOptions(headerUri, 1);
    for (const option of options) {
        assert.ok(publisher.selectContext(headerUri, option.unitUri, option.occurrence?.id));
    }
    return { overview, selected: emitted.slice(overview.length), options: options.map(item => ({
        unitUri: item.unitUri, id: item.occurrence?.id,
        span: item.occurrence?.expandedSpan
    })) };
}

test('provider parity: semantic hover, definition, references and folding on a real translation unit', async () => {
    const { original, restored } = await results();
    const probe = (pair: readonly [AnalysisResult, AnalysisResult]) => {
        const { registry, docs, first } = harness(pair);
        const document = docs.get(firstUri)!;
        const offset = firstText.indexOf('Local := Local') + 'Local := '.length;
        assert.ok(offset > 0);
        const point = document.positionAt(offset);
        const hover = astHover(first, firstUri, offset);
        const target = definition(first, registry, firstUri, offset);
        const refs = findReferences(first.rootAnalysis, firstUri, point, true, registry);
        const refsWithoutDeclaration = findReferences(first.rootAnalysis, firstUri, point, false, registry);
        const fold = createFoldingRangesForDocument(document, first, undefined, quiet);
        assert.ok(refs.length >= 2, 'Semantic reference provider must return real occurrences');
        assert.ok(refsWithoutDeclaration.length >= 1, 'Reference provider must return usages');
        assert.ok(fold.length >= 1, 'Procedure folding must be present');
        assert.equal(target.uri, firstUri);
        return { hover, target, refs, refsWithoutDeclaration, fold };
    };
    assert.deepEqual(probe(restored), probe(original));
});

test('provider parity: guarded include hover and physical/AST folding in both executions', async () => {
    const { original, restored } = await results();
    const probe = (pair: readonly [AnalysisResult, AnalysisResult]) => {
        const { docs, registry } = harness(pair);
        const options = registry.getIncludeContextOptions(headerUri, 1);
        assert.equal(options.length, 3, 'Two includes in First.P and one in Second.P');
        const included = docs.get(headerUri)!;
        return options.map(option => {
            assert.ok(option.occurrence);
            assert.ok(registry.selectIncludeContextOption(headerUri, 1,
                option.unitUri, option.occurrence.id));
            const result = registry.getAnalysisResultForSource(headerUri, 1);
            assert.ok(result);
            const position = registry.getSourceLookupPosition(headerUri, 1,
                headerText.indexOf('SHARED_GUARD') + 2);
            const conditional = PreprocessorConditionalBlockLookup.lookup(
                result.rootAnalysis.preprocessorConditionalBlocks,
                position,
                option.occurrence.id
            );
            assert.ok(conditional, 'Conditional hover must respect selected include execution');
            return {
                option: { unitUri: option.unitUri, occurrenceId: option.occurrence.id },
                selected: registry.getSelectedIncludeContextOption(headerUri, 1)?.occurrence?.id,
                condition: conditional.block.conditionSatisfied,
                hover: createHover(PreprocessorConditionalBlockDocumentationProvider.getDocumentation(conditional)),
                folding: createFoldingRangesForDocument(included, result, option.occurrence, quiet)
            };
        });
    };
    const before = probe(original);
    const after = probe(restored);
    assert.deepEqual(after, before);
    assert.deepEqual(before.map(value => value.condition), [true, false, true]);
    assert.ok(before.every(value => value.folding.length >= 1));
});

test('provider parity: CodeLens context options, selection and diagnostic publication', async () => {
    const { original, restored } = await results();
    const before = diagnostics(original);
    const after = diagnostics(restored);
    assert.equal(before.options.length, 3);
    assert.ok(before.overview.length > 0, 'Diagnostic publisher must emit real notifications');
    assert.deepEqual(after, before);
});

test('provider parity: macro hover, definition and Find References', async () => {
    const { original, restored } = await results();
    const probe = (pair: readonly [AnalysisResult, AnalysisResult]) => {
        const { registry, docs, first } = harness(pair);
        const document = docs.get(headerUri)!;
        const position = cursor(document, headerText, '#define SHARED_GUARD');
        const point = document.positionAt(document.offsetAt(position) + '#define '.length + 2);
        const macro = first?.lookupMacro({ uri: headerUri, offset: document.offsetAt(point) });
        assert.ok(macro, 'Macro definition lookup must work');
        const refs = findMacroReferences(first.rootAnalysis.macroOccurrences,
            headerUri, point, true, registry);
        assert.ok(refs && refs.length >= 1, 'Macro references must include definition');
        return {
            hover: createHover(MacroDocumentationProvider.getDocumentation(macro)),
            definition: macro.definition.location && mapLspLocation(macro.definition.location, registry),
            refs
        };
    };
    assert.deepEqual(probe(restored), probe(original));
});

test('provider parity: LSP signature help at an actual call site', async () => {
    const uri = base + 'Signature.P';
    const text = `MODULE Sig; PROBLEM;\nSPC Handler ENTRY(FIXED, FLOAT);\nMain: TASK; CALL Handler(1, 2.0); END;\nMODEND;`;
    const doc = TextDocument.create(uri, 'pearl', 1, text);
    const registry = new MemoryRegistry(new Map([[uri, doc]]));
    const result = await new Validator({} as WorkspaceManager, registry, quiet)
        .analyze(doc, defaultSettings);
    const restored = decodeAnalysisResult(structuredClone(encodeAnalysisResult(result)));
    const offset = text.indexOf('Handler(1') + 'Handler(1, '.length;
    const lookup = (r: AnalysisResult) => {
        const context = r.rootAnalysis.callSignatureHelp?.lookup({ uri, offset });
        assert.ok(context, 'Call site must produce a signature-help context');
        return createSignatureHelp(context);
    };
    assert.deepEqual(lookup(restored), lookup(result));
});

test('provider parity: stale document versions cannot resurrect included contexts', async () => {
    const { original, restored } = await results();
    const probe = (pair: readonly [AnalysisResult, AnalysisResult]) => {
        const { registry } = harness(pair);
        const before = registry.getIncludeContextOptions(headerUri, 1).length;
        const stale = registry.getIncludeContextOptions(headerUri, 2).length;
        const unresolved = registry.getAnalysisResultForSource(headerUri, 2);
        return { before, stale, unresolved: unresolved === undefined };
    };
    assert.deepEqual(probe(restored), probe(original));
    assert.deepEqual(probe(original), { before: 3, stale: 0, unresolved: true });
});


test('provider parity: semantic tokens on root and selected repeated include occurrences', async () => {
    const { original, restored } = await results();
    const probe = async (pair: readonly [AnalysisResult, AnalysisResult]) => {
        const { registry } = harness(pair);
        const service = new SemanticTokenService(registry, quiet, new TokenLegend());
        const root = await service.handleFull({ textDocument: { uri: firstUri } });
        assert.ok(root.data.length > 0, 'Root must expose real classified tokens');
        const header: number[][] = [];
        for (const option of registry.getIncludeContextOptions(headerUri, 1)) {
            assert.ok(option.occurrence);
            assert.ok(registry.selectIncludeContextOption(headerUri, 1,
                option.unitUri, option.occurrence.id));
            const tokens = await service.handleFull({ textDocument: { uri: headerUri } });
            header.push([...tokens.data]);
        }
        return { root: root.data, header };
    };
    assert.deepEqual(await probe(restored), await probe(original));
});
