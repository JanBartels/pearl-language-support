// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { lookupIncludeTarget } from '../../../preproc/includeOccurrence';
import { Validator } from '../../../validation/validator';
import { AnalysisResult } from '../../../validation/analysisResult';
import { Analysis } from '../../../validation/analysis';
import { SourceValue } from '../../../core/sourceValue';
import { FileSource } from '../../../source/fileSource';
import { mapToOriginalLocation } from '../../../core/sourceOffset';
import { TokenKind } from '../../../lexer/token';
import { ProblemCollection } from '../../../core/problemCollection';
import { PreprocessorConditionalBlockCollection } from '../../../preproc/preprocessorConditionalBlockCollection';
import { MacroOccurrenceIndex } from '../../../preproc/macroOccurrenceIndex';
import { SymbolReferenceIndex } from '../../../semantic/symbolReferenceIndex';
import { SymbolReferenceResolutionIndex } from '../../../semantic/symbolReferenceResolutionIndex';
import { SourceHighlightKind } from '../../../semantic/sourceHighlight';
import type { DocumentRegistry } from '../../documentRegistry';
import type { WorkspaceManager } from '../../workspace';
import type { PearlSettings } from '../../../settings/pearlSettings';
import { encodeAnalysisResult, decodeAnalysisResult, type AnalysisResultWire } from '../analysisResultTransport';

const settings: PearlSettings = {
    traceServer: 'off', maxNumberOfProblems: 100, warnOnCharTruncation: true, macros: { FROM_SETTINGS: '7' }
};
const logger = {info() {}, warn() {}, error() {}};
function validator(include: Record<string,string> = {}) {
    const resolver = {
        resolveInclude(uri: string, includePath: string) {
            const target = new URL(includePath, uri).href;
            const text = include[target];
            return text === undefined ? null : {uri:target, getText:() => text};
        },
        resolveIncludeUri(uri: string, includePath: string) { return new URL(includePath,uri).href; }
    };
    return new Validator({} as WorkspaceManager, resolver as unknown as DocumentRegistry, logger);
}
async function analyze(text:string,uri='file:///project/main.P',includes:Record<string,string>={}) {
    return validator(includes).analyze(TextDocument.create(uri,'pearl',1,text), settings);
}
function roundtrip(original:AnalysisResult) {
    const encoded = encodeAnalysisResult(original);
    assert.doesNotThrow(() => JSON.stringify(encoded));
    return {wire:encoded, result:decodeAnalysisResult(structuredClone(encoded))};
}

// Covers the actual mainline Compiler -> AnalysisResult pipeline (not mocks).
test('complete Validator result retains AST, semantic lookups, diagnostics and source references', async () => {
    const original = await analyze('MODULE Main; PROBLEM; DCL A FIXED; DCL B REF FIXED; TYPE Node STRUCT[Next REF Node]; MODEND;');
    const {result,wire} = roundtrip(original);
    const before=original.rootAnalysis;
    const after=result.rootAnalysis;
    assert.equal(result.getFile(after.source.uri),after);
    assert.notEqual(before,after);
    assert.equal(after.ast.constructor.name,before.ast.constructor.name);
    assert.equal(after.ast.dumpLabel(),before.ast.dumpLabel());
    assert.equal(after.semanticContext?.bindings.size,before.semanticContext?.bindings.size);
    assert.equal(after.symbolReferences.all.length,before.symbolReferences.all.length);
    assert.equal(after.symbolReferenceResolutions.all.length,before.symbolReferenceResolutions.all.length);
    assert.equal(after.symbolOccurrences.all.length,before.symbolOccurrences.all.length);
    assert.equal(after.hasErrors(),before.hasErrors());
    assert.equal(result.hasErrors(),original.hasErrors());
    assert.equal([...result.problems][0], [...after.problems][0]);
    assert.deepEqual([...result.problems].map(p=>[p.message,p.severity,p.code,p.includeOccurrenceId]),
        [...original.problems].map(p=>[p.message,p.severity,p.code,p.includeOccurrenceId]));
    assert.equal(after.source.text,before.source.text);
    assert.equal(after.callSignatures !== undefined,before.callSignatures !== undefined);
    assert.equal(after.callSignatureHelp !== undefined,before.callSignatureHelp !== undefined);
    assert.equal(wire.analyses.length,1);
    const at = before.source.text.indexOf('Node');
    const p={uri:before.source.uri,offset:at+1};
    const b=before.ast.lookupSourceValue(p);
    const a=after.ast.lookupSourceValue(p);
    assert.equal(a?.element.value,b?.element.value);
    assert.equal(a?.node.kind,b?.node.kind);
    assert.equal(typeof after.ast.documentationProvider,'function');
    for (const h of after.sourceHighlights) {
        assert.equal(typeof h.element.contains,'function');
        assert.ok(h.kind in SourceHighlightKind || Number.isInteger(h.kind));
    }
});

test('included source executions, source locations and watches survive the roundtrip', async () => {
    const uri='file:///project/main.P';
    const inc='file:///project/inc.h';
    const text='#include "inc.h"\n#include "inc.h"\n#include "missing.h"\nMODULE X; PROBLEM; MODEND;';
    const original = await analyze(text,uri,{[inc]:'TYPE Included FIXED;\n'});
    const {result} = roundtrip(original);
    assert.deepEqual(result.includedSourceUris,original.includedSourceUris);
    assert.deepEqual(result.watchedIncludeUris,original.watchedIncludeUris);
    assert.equal(result.includeOccurrences.length,original.includeOccurrences.length);
    const repeated = result.includeOccurrences.filter(o => o.sourceUri === inc);
    assert.equal(repeated.length,2);
    assert.equal(lookupIncludeTarget(result.includeOccurrences, uri, uri, text.indexOf('inc.h'))?.id, repeated[0]!.id);
    assert.equal(lookupIncludeTarget(result.includeOccurrences, uri, uri, text.lastIndexOf('inc.h'))?.id, repeated[1]!.id);
    assert.notEqual(repeated[0]?.source, repeated[1]?.source,
        'Two executions of the same include URI must retain distinct Source objects');
    for (let i=0;i<result.includeOccurrences.length;i++) {
        const got=result.includeOccurrences[i]!;
        const expected=original.includeOccurrences[i]!;
        assert.deepEqual([got.id,got.sourceUri,got.sites,got.expandedSpan],
            [expected.id,expected.sourceUri,expected.sites,expected.expandedSpan]);
        assert.equal(got.source?.uri,expected.source?.uri);
    }
    const failures=[...result.problems].filter(p=>p.includeOccurrenceId !== undefined);
    for(const item of failures) {
        assert.equal(typeof item.includeOccurrenceId,'string');
        assert.equal(mapToOriginalLocation(item.location).source.uri,uri);
    }
});

test('macro references, definitions, conditional blocks and lookupMacro share identities', async () => {
    const text='#define TEST "42"\n#ifdef TEST\nMODULE Macros;\n#else\nMODULE NotMacros;\n#endif\nPROBLEM; DCL A FIXED; MODEND;';
    const original=await analyze(text);
    const {result}=roundtrip(original);
    const before=original.rootAnalysis;
    const after=result.rootAnalysis;
    assert.equal(after.macroReferences.length,before.macroReferences.length);
    assert.equal(after.macroDefinitions.length,before.macroDefinitions.length);
    assert.equal(after.macroOccurrences.all.length,before.macroOccurrences.all.length);
    assert.equal(after.preprocessorConditionalBlocks.size(),before.preprocessorConditionalBlocks.size());
    const first=[...after.preprocessorConditionalBlocks][0];
    const old=[...before.preprocessorConditionalBlocks][0];
    if (first && old) {
        assert.equal(first.conditionSatisfied,old.conditionSatisfied);
        assert.equal(first.macro,old.macro);
        assert.equal(first.macroDefinition?.name,old.macroDefinition?.name);
        if (first.macroDefinition) {
            assert.equal(after.macroOccurrences.all.some(group=>group.definition===first.macroDefinition),
                before.macroOccurrences.all.some(group=>group.definition===old.macroDefinition));
        }
    }
    for(const ref of after.macroReferences) {
        assert.ok(after.macroOccurrences.all.some(group=>group.definition===ref.definition));
    }
    const pos={uri:after.source.uri,offset:text.indexOf('TEST',text.indexOf('#ifdef'))+1};
    assert.equal(result.lookupMacro(pos)?.definition.name,original.lookupMacro(pos)?.definition.name);
});

test('block-comment tokens retain compilerOption() and active comment identity', async () => {
    const original=await analyze('MODULE Test; /*+D=FIXED(15)*/ PROBLEM; /* normal comment */ DCL A FIXED; MODEND;');
    const {result}=roundtrip(original);
    const before=original.rootAnalysis;
    const after=result.rootAnalysis;
    assert.equal(after.tokens.length,before.tokens.length);
    for (const token of after.tokens) {
        const originalToken=before.tokens[after.tokens.indexOf(token)]!;
        assert.equal(token.kind,originalToken.kind);
        assert.equal(token.location.source,after.source);
        if (token.kind===TokenKind.Comment) {
            const comment=token as typeof after.blockComments[number];
            assert.equal(typeof comment.compilerOption,'function');
            assert.deepEqual(comment.compilerOption(),
                (originalToken as typeof comment).compilerOption());
        }
    }
    assert.equal(after.blockComments.length,before.blockComments.length);
    for(const comment of after.activeBlockComments) {
        assert.equal(typeof comment.compilerOption,'function');
    }
});

test('two Analyses share a single decoded Source and SourceValue identity graph', async () => {
    const one=await analyze('MODULE One; PROBLEM; DCL A FIXED; MODEND;','file:///one.P');
    const other=await analyze('MODULE Two; PROBLEM; DCL B FIXED; MODEND;','file:///two.P');
    // Make a second analysis with an independent source but a shared AST and
    // shared semantic context to detect an accidental per-analysis decoder.
    const a=one.rootAnalysis;
    const b=other.rootAnalysis;
    const shared=new SourceValue('shared', {source:a.source,span:{start:0,end:6}});
    const extended = new Analysis(b.source,b.tokens,a.ast,b.problems,b.macroReferences,
        new PreprocessorConditionalBlockCollection(),a.semanticContext,
        a.symbolReferences,a.symbolReferenceResolutions,a.symbolOccurrences,
        b.macroDefinitions,new MacroOccurrenceIndex(b.macroDefinitions,b.macroReferences),
        b.activeBlockComments,[{element:shared,kind:SourceHighlightKind.Type}]);
    const combined=AnalysisResult.create(a,[a,extended]);
    const {result}=roundtrip(combined);
    assert.equal(result.files.size,2);
    const restoredA=result.getFile(a.source.uri)!;
    const restoredB=result.getFile(b.source.uri)!;
    assert.equal(restoredA.ast,restoredB.ast);
    assert.equal(restoredA.semanticContext?.bindings.values().next().value,
        restoredB.semanticContext?.bindings.values().next().value);
    assert.equal(restoredB.sourceHighlights[0]?.element.location?.source,restoredA.source);
    assert.notEqual(restoredB.source,restoredA.source);
});

test('version, broken IDs and missing semantic graphs fail explicitly',async()=>{
    const original=await analyze('MODULE One; PROBLEM; MODEND;');
    const wire=encodeAnalysisResult(original);
    assert.throws(()=>decodeAnalysisResult({...wire,version:2} as unknown as AnalysisResultWire),/version/);
    assert.throws(()=>decodeAnalysisResult({...wire,rootIndex:25}),/root analysis/);
    assert.throws(()=>decodeAnalysisResult({...wire,files:[[wire.files[0]![0],25]]}),/file analysis/);
    assert.throws(()=>decodeAnalysisResult({...wire,analyses:[{...wire.analyses[0]!,sourceId:88888}]}),/SourceGraph/);
    assert.throws(()=>decodeAnalysisResult({...wire,analyses:[{...wire.analyses[0]!,semantic:{...wire.analyses[0]!.semantic,indices:undefined}}]}),/semantic indices/);
});


test('semantic highlights point to the very SourceValues used as binding keys', async () => {
    const text='MODULE Demo; PROBLEM; DCL A FIXED; A := 17; MODEND;';
    const original = await analyze(text);
    const {result}=roundtrip(original);
    const analysis=result.rootAnalysis;
    const highlights=analysis.sourceHighlights.filter(h=>
        analysis.semanticContext?.bindings.has(h.element as SourceValue<string>));
    assert.ok(highlights.length>0);
    assert.equal(highlights.length,original.rootAnalysis.sourceHighlights.filter(h=>
        original.rootAnalysis.semanticContext?.bindings.has(h.element as SourceValue<string>)).length);
    for(const highlight of highlights) {
        assert.ok(analysis.semanticContext?.bindings.get(highlight.element as SourceValue<string>));
    }
});

test('new fields in compiler output must be handled before enabling worker transport', async () => {
    const original = await analyze('MODULE Test; PROBLEM; MODEND;');
    Object.assign(original.rootAnalysis, {newCompilerFeature: 42});
    assert.throws(()=>encodeAnalysisResult(original),/Unsupported Analysis field.*newCompilerFeature/);
    delete (original.rootAnalysis as unknown as {newCompilerFeature?: number}).newCompilerFeature;
    Object.assign(original, {newResultFeature: 'unsupported'});
    assert.throws(()=>encodeAnalysisResult(original),/Unsupported AnalysisResult field.*newResultFeature/);
});
