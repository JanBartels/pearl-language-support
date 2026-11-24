// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TranslationUnitNode } from '../../../ast/module/translationUnitNode';
import { ModuleNode } from '../../../ast/module/moduleNode';
import { FileSource } from '../../../source/fileSource';
import { SourceValue } from '../../../core/sourceValue';
import { SemanticContext } from '../../../semantic/semanticContext';
import { SemanticTypeKind } from '../../../semantic/semanticType';
import { SymbolKind } from '../../../semantic/symbolKind';
import { SymbolUsageIndex, SymbolAccessKind } from '../../../semantic/symbolUsageIndex';
import { SymbolReferenceKind } from '../../../semantic/symbolReference';
import { SymbolReferenceIndex } from '../../../semantic/symbolReferenceIndex';
import { SymbolReferenceResolutionIndex } from '../../../semantic/symbolReferenceResolutionIndex';
import { SemanticConstantKind, SemanticInitialValueKind } from '../../../semantic/semanticConstantValue';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../../../semantic/semanticDiagnostic';
import { lookupBuiltin } from '../../../semantic/builtins/builtinCatalog';
import type { TypeSymbol, DataObjectSymbol, SemanticSymbol } from '../../../semantic/symbol';
import type { SemanticType } from '../../../semantic/semanticType';
import type { SymbolReference } from '../../../semantic/symbolReference';
import type { SemanticContextWire, SemanticGraphWire } from '../semanticGraphTransport';
import { SemanticGraphEncoder, decodeSemanticGraph, encodeSemanticGraph } from '../semanticGraphTransport';

const file = new FileSource('file:///semantic.P', 'MODULE Test; DCL A REF Node; TYPE Node STRUCT[Next REF Node];');
const value = (text: string, offset: number) => new SourceValue(text, {
    source:file,span:{start:offset,end:offset+text.length}
});

function fixture() {
    const root = new TranslationUnitNode();
    const typeName = value('Node', 34);
    const usedName = value('A',17);
    const usageName = value('A',22);
    const builtinName = value('PI',0);
    const typeSymbol:TypeSymbol = {kind:SymbolKind.Type,name:typeName,definition:typeName};
    // The same exact object reappears through NamedType, REF and the type index.
    const named:SemanticType = {kind:SemanticTypeKind.Named,symbol:typeSymbol};
    const reference:SemanticType = {kind:SemanticTypeKind.Reference,target:named,targetInvariant:false};
    const fieldName=value('Next',46);
    const struct:SemanticType={kind:SemanticTypeKind.Struct,
        components:[{name:fieldName,type:reference}]};
    const object:DataObjectSymbol={kind:SymbolKind.DataObject,name:usedName,type:reference,
        global:{kind:'global'},assignmentProtected:true,hasInitializationAttribute:true};
    const identifier=value('A',22);
    const ref:SymbolReference={identifier,kind:SymbolReferenceKind.Read,node:root};
    const usage = {symbol:object,declaration:usedName,references:[ref],accesses:[{kind:SymbolAccessKind.Read,reference:ref}],
        read:true,written:false,addressTaken:false,uncertain:false,initialized:true,
        externallyVisible:true,implicitlyUsed:false,unused:false};
    const location={source:file,span:{start:17,end:18}};
    const diagnostics=[{code:SemanticDiagnosticCode.UnknownIdentifier,severity:SemanticDiagnosticSeverity.Warning,
        message:'Testdiagnostic',location,lexicalLocation:location}];
    const builtin=lookupBuiltin('PI');
    if (!builtin) throw new Error('Missing builtin PI');
    const context=new SemanticContext(
        new Map([[typeSymbol,struct]]),
        new Map<SourceValue<string>,SemanticSymbol>([[usedName,object],[identifier,object],[typeName,typeSymbol]]),
        diagnostics,
        new Map(),
        new Map([[object,{kind:SemanticConstantKind.Fixed,value:12345678901234567890n}]]),
        new Map([[object,{kind:SemanticInitialValueKind.Constant,
            values:[{kind:SemanticConstantKind.Fixed,value:2n}],elementCount:1000000000000n}]]),
        new Map([[root,{kind:SemanticConstantKind.Fixed,value:7n}]]),
        new Map([[root,{kind:SemanticConstantKind.Duration,seconds:{coefficient:55n,scale:2}}]]),
        new Map([[object,[{kind:SemanticConstantKind.Fixed,value:3n}]]]),
        new Map(),
        new Map(),
        new Map([[builtinName,builtin]]),
        new Map([[usedName,{kind:'PROC',specification:usedName,definition:usedName}]]),
        new Map(),
        new SymbolUsageIndex([usage]),
        new Set([usageName]),
        new Set([usedName]),
        new Map([[identifier,true]])
    );
    return {root,context,typeSymbol,struct,reference,object,usedName,typeName,identifier,ref};
}

test('symbol, type and context roundtrip preserves cyclic named types and object identity',()=>{
    const f=fixture();
    const wire=structuredClone(encodeSemanticGraph(f.root,f.context,[file]));
    assert.doesNotThrow(()=>JSON.stringify(wire));
    const restored=decodeSemanticGraph(wire);
    assert.ok(restored.ast.root instanceof TranslationUnitNode);
    const c=restored.context;
    assert.equal(c.bindings.size,3);
    const byName=[...c.bindings.entries()];
    const object=byName[0]![1] as DataObjectSymbol;
    assert.equal(object,byName[1]![1]);
    assert.notEqual(object,byName[2]![1]);
    assert.equal(object.assignmentProtected,true);
    assert.equal(object.global?.kind,'global');
    const typeSymbol=byName[2]![1] as TypeSymbol;
    const structure=c.typeDefinitions.get(typeSymbol)!;
    assert.equal(structure.kind,SemanticTypeKind.Struct);
    if(structure.kind!==SemanticTypeKind.Struct)throw new Error('bad type');
    const ref=structure.components[0]!.type;
    assert.equal(ref.kind,SemanticTypeKind.Reference);
    if(ref.kind!==SemanticTypeKind.Reference)throw new Error('bad reference type');
    assert.equal(ref.target.kind,SemanticTypeKind.Named);
    if(ref.target.kind!==SemanticTypeKind.Named)throw new Error('bad named type');
    assert.equal(ref.target.symbol,typeSymbol);
    assert.equal(object.type,ref);
    assert.equal(structure.components[0]!.name.value,'Next');
    assert.equal(c.builtinBindings.size,1);
    assert.equal([...c.builtinBindings.values()][0],lookupBuiltin('PI'));
    assert.equal(c.diagnostics[0]?.location.source,restored.ast.sourceValues.sources.roots[0]);
    assert.equal(c.diagnostics[0]?.lexicalLocation?.source,restored.ast.sourceValues.sources.roots[0]);
    assert.equal(c.namedConstantValues.get(object)?.kind,SemanticConstantKind.Fixed);
    assert.equal(c.initialValues.get(object)?.elementCount,1000000000000n);
    assert.equal(c.constantFixedValues.get(restored.ast.root)?.value,7n);
    assert.equal(c.timeConstantValues.get(restored.ast.root)?.kind,SemanticConstantKind.Duration);
    assert.equal(c.semaPresetValues.get(object)?.[0].value,3n);
    assert.equal(c.nameAccessProtections.get(byName[1]![0]),true);
    assert.equal(c.localSpecificationRelations.get(byName[0]![0])?.definition,byName[0]![0]);
    const originalUse=c.symbolUsages.all[0]!;
    assert.equal(originalUse.symbol,object);
    assert.equal(originalUse.declaration,byName[0]![0]);
    const symbolRef=originalUse.references[0]!;
    assert.equal(originalUse.accesses[0]?.reference,symbolRef);
    assert.equal(symbolRef.node,restored.ast.root);
    assert.equal(c.symbolUsages.lookupReference(symbolRef.identifier),originalUse);
    assert.equal(c.symbolUsages.lookupAccess(symbolRef.identifier)?.kind,SymbolAccessKind.Read);
});

test('identical SourceValues at one physical position remain independent map keys',()=>{
    const f=fixture();
    const alternate=value('A',22);
    const sem=new SemanticContext(undefined,new Map<SourceValue<string>,SemanticSymbol>([[f.identifier,f.object],[alternate,f.typeSymbol]]));
    const restored=decodeSemanticGraph(structuredClone(encodeSemanticGraph(f.root,sem,[file])));
    assert.equal(restored.context.bindings.size,2);
    const keys=[...restored.context.bindings.keys()];
    assert.notEqual(keys[0],keys[1]);
    assert.deepEqual(keys.map(key=>key.location?.span),[keys[0]!.location?.span,keys[0]!.location?.span]);
});

test('types preserve precision, dimensions, procedure signatures and exact decimal constants',()=>{
    const f=fixture();
    const array:SemanticType={kind:SemanticTypeKind.Array,
        elementType:{kind:SemanticTypeKind.Character,length:77},dimensions:[{lowerBound:-2n,upperBound:999999999999999999n}]};
    const signature:SemanticType={kind:SemanticTypeKind.Procedure,hasResult:true,callingConvention:'C',
        parameters:[{type:array,byIdentification:true,assignmentProtected:false}],
        resultType:{kind:SemanticTypeKind.Float,precision:55}};
    const symbol:DataObjectSymbol={kind:SymbolKind.DataObject,name:value('Proc',0),type:signature,assignmentProtected:false,global:undefined};
    const ctx=new SemanticContext(undefined,new Map([[symbol.name,symbol]]));
    const decoded=decodeSemanticGraph(structuredClone(encodeSemanticGraph(f.root,ctx,[file])));
    const recovered=[...decoded.context.bindings.values()][0] as DataObjectSymbol;
    assert.equal(recovered.type.kind,SemanticTypeKind.Procedure);
    if(recovered.type.kind!==SemanticTypeKind.Procedure)throw new Error('bad signature');
    assert.equal(recovered.type.callingConvention,'C');
    const p=recovered.type.parameters[0]!;
    assert.equal(p.byIdentification,true);
    assert.equal(p.type?.kind,SemanticTypeKind.Array);
    if(p.type?.kind!==SemanticTypeKind.Array)throw new Error('bad array');
    assert.deepEqual(p.type.dimensions,[{lowerBound:-2n,upperBound:999999999999999999n}]);
});

test('invalid versions, broken type/symbol references and duplicate keys fail loudly',()=>{
    const f=fixture();
    const wire=encodeSemanticGraph(f.root,f.context,[file]);
    assert.throws(()=>decodeSemanticGraph({...wire,version:2} as unknown as SemanticGraphWire),/version/);
    assert.throws(()=>decodeSemanticGraph({...wire,symbols:[...wire.symbols,wire.symbols[0]!]}),/Duplicate/);
    assert.throws(()=>decodeSemanticGraph({...wire,types:[...wire.types,wire.types[0]!]}),/Duplicate/);
    const broken={...wire,context:{...wire.context,bindings:[[999999,1]]} as SemanticContextWire};
    assert.throws(()=>decodeSemanticGraph(broken),/Missing SourceValue identity/);
    const badType={...wire,symbols:wire.symbols.map(s=>s.kind===SymbolKind.DataObject?{...s,type:99999}:s)};
    assert.throws(()=>decodeSemanticGraph(badType),/Missing semantic type identity/);
});

test('roundtrip of an actual Validator SemanticContext preserves semantic lookup results', async()=>{
    const { TextDocument }=require('vscode-languageserver-textdocument') as typeof import('vscode-languageserver-textdocument');
    const { Validator }=require('../../../validation/validator') as typeof import('../../../validation/validator');
    const text=`MODULE Semantics; PROBLEM;
TYPE Node STRUCT[ Value FIXED, Next REF Node ];
TYPE Counter FIXED;
DCL X FIXED INIT(7);
DCL R REF Node;
MODEND;`;
    const doc=TextDocument.create('file:///semantic-real.P','pearl',1,text);
    const validator=new Validator({} as never,{resolveInclude:()=>null} as never,
        {info() {},warn() {},error() {},debug() {}} as never);
    const settings={traceServer:'off',maxNumberOfProblems:100,workingDirMode:'file',warnOnCharTruncation:true,macros:{}} as const;
    const result=await validator.analyze(doc,settings);
    const original=result.rootAnalysis;
    const semantic=original.semanticContext;
    if (!semantic) throw new Error('Expected semantic analysis');
    const wire=structuredClone(encodeSemanticGraph(original.ast,semantic,[original.source],{
        references:original.symbolReferences,resolutions:original.symbolReferenceResolutions
    }));
    const rebuilt=decodeSemanticGraph(wire);
    const context=rebuilt.context;
    assert.equal(rebuilt.references?.all.length,original.symbolReferences.all.length);
    assert.equal(rebuilt.resolutions?.all.length,original.symbolReferenceResolutions.all.length);
    assert.equal(rebuilt.occurrences?.all.length,original.symbolOccurrences.all.length);
    for(const result of rebuilt.resolutions?.all??[]){
        assert.equal(rebuilt.references?.lookup(result.reference.identifier),result.reference);
        assert.equal(rebuilt.resolutions?.lookup(result.reference.identifier),result);
        if(result.kind==='bound') {
            assert.equal(context.bindings.get(result.reference.identifier),result.symbol);
            assert.ok(rebuilt.resolutions?.referencesOf(result.declaration).includes(result));
        }
    }
    for(const name of ['X','R','Node','Counter']) {
        const originalEntry=[...semantic.bindings].find(([sv])=>sv.value===name);
        if (!originalEntry) throw new Error(`Original binding missing for ${name}`);
        const restoredEntry=[...context.bindings].find(([sv])=>sv.value===name);
        if (!restoredEntry) throw new Error(`Restored binding missing for ${name}`);
        assert.equal(restoredEntry[1].kind,originalEntry[1].kind);
        assert.equal(restoredEntry[1].name.value,originalEntry[1].name.value);
        assert.equal(restoredEntry[1],context.bindings.get(restoredEntry[0]));
    }
    assert.equal(context.typeDefinitions.size,semantic.typeDefinitions.size);
    assert.equal(context.expressionTypes.size,semantic.expressionTypes.size);
    assert.equal(context.constantFixedValues.size,semantic.constantFixedValues.size);
    assert.equal(context.diagnostics.length,semantic.diagnostics.length);
    assert.equal(context.symbolUsages.all.length,semantic.symbolUsages.all.length);
    const x=[...context.bindings.values()].find(symbol=>symbol.name.value==='X');
    if (!x || !x.name.location) throw new Error('Missing X declaration');
    assert.equal(x.name.location.source.uri,doc.uri);
});


test('reference, resolution and occurrence indices reconstruct through constructors with shared identities',()=>{
    const f=fixture();
    const index=new SymbolReferenceIndex([f.ref]);
    const resolutions=new SymbolReferenceResolutionIndex([{
        kind:'bound',reference:f.ref,symbol:f.object,declaration:f.usedName,diagnostics:[]
    }]);
    const wire=structuredClone(encodeSemanticGraph(f.root,f.context,[file],{references:index,resolutions}));
    const decoded=decodeSemanticGraph(wire);
    if (!decoded.references || !decoded.resolutions || !decoded.occurrences) throw new Error('Missing rebuilt indices');
    const reference=decoded.references.all[0]!;
    const resolution=decoded.resolutions.all[0]!;
    assert.equal(resolution.reference,reference);
    assert.equal(decoded.resolutions.lookup(reference.identifier),resolution);
    assert.equal(decoded.resolutions.referencesOf(resolution.kind==='bound'?resolution.declaration:reference.identifier)[0],resolution);
    assert.equal(decoded.context.symbolUsages.lookupReference(reference.identifier)?.references[0],reference);
    const definition=[...decoded.context.bindings.values()].find(s=>s.name.value==='A')!;
    assert.equal(resolution.kind==='bound'?resolution.symbol:undefined,definition);
    assert.equal(decoded.occurrences.lookup(reference.identifier)?.declaration,definition.name);
});


test('module settings, diagnostics and reference initializers survive with exact bigint values',()=>{
    const root=new TranslationUnitNode();
    const module=new ModuleNode(value('MODULE',0),value('Test',7));
    root.addChild(module);
    const declaration=value('X',17);
    const object:DataObjectSymbol={kind:SymbolKind.DataObject,name:declaration,
        global:undefined,type:{kind:SemanticTypeKind.Fixed,precision:31},assignmentProtected:false};
    const config={modes:[value('CLOCK50',1)],timeResolution:{numerator:1n,denominator:20000n},
        fullCharacterComparison:false,noLineStop:true,padding:false,debugInformation:true,
        processor:{name:'PPC',explicitFpu:true,fpuRegisters:32},
        moduleSize:{size:1024n,clearOnLoad:true,codeAddress:100000000000n,varAddress:150000000000n},
        setLine:{firstLine:123,moduleId:3},maxErrors:55};
    const diagnostic={code:SemanticDiagnosticCode.UnknownType,severity:SemanticDiagnosticSeverity.Error,
        message:'Unknown type',location:{source:file,span:{start:0,end:6}},
        tags:[],relatedLocations:[{message:'Related',location:{source:file,span:{start:7,end:11}}}]};
    const context=new SemanticContext(undefined,new Map([[declaration,object]]),[diagnostic],
        undefined,undefined,new Map([[object,{kind:SemanticInitialValueKind.Reference,
            elementCount:33n,values:[object,null,object]}]]),
        undefined,undefined,undefined,new Map([[module,config]]));
    const decoded=decodeSemanticGraph(structuredClone(encodeSemanticGraph(root,context,[file])));
    const actualModule=decoded.ast.root.getChildren()[0] as ModuleNode;
    const restored=decoded.context.moduleConfigurations.get(actualModule);
    if (!restored) throw new Error('Missing module configuration');
    assert.equal(restored.moduleSize?.codeAddress,100000000000n);
    assert.equal(restored.moduleSize?.varAddress,150000000000n);
    assert.equal(restored.timeResolution.denominator,20000n);
    assert.equal(restored.modes[0]!.value,'CLOCK50');
    assert.equal(decoded.context.diagnostics[0]?.relatedLocations?.[0]?.location.source,
        decoded.ast.sourceValues.sources.roots[0]);
    const symbol=decoded.context.bindings.get([...decoded.context.bindings.keys()][0]!) as DataObjectSymbol;
    const initial=decoded.context.initialValues.get(symbol);
    assert.equal(initial?.kind,SemanticInitialValueKind.Reference);
    if(initial?.kind!==SemanticInitialValueKind.Reference)throw new Error('missing reference initializer');
    assert.equal(initial.elementCount,33n);
    assert.equal(initial.values[0],symbol);
    assert.equal(initial.values[1],null);
    assert.equal(initial.values[2],symbol);
});

test('builtin, deferred, unresolved and monadic reference resolutions preserve original kinds',()=>{
    const root=new TranslationUnitNode();
    const names=['PI','MISSING','FIELD','+'].map((name,i)=>value(name,i*5));
    const refs=names.map((identifier,i):SymbolReference=>({
        identifier,kind:SymbolReferenceKind.Read,node:root
    }));
    const builtin=lookupBuiltin('PI');
    if(!builtin)throw new Error('builtin not found');
    const index=new SymbolReferenceIndex(refs);
    const resolutions=new SymbolReferenceResolutionIndex([
        {kind:'builtin',reference:refs[0]!,builtin,diagnostics:[]},
        {kind:'unresolved',reference:refs[1]!,diagnostics:[]},
        {kind:'deferred',reference:refs[2]!,reason:'structuralName',diagnostics:[]},
        {kind:'monadicOperator',reference:refs[3]!,diagnostics:[]}
    ]);
    const decoded=decodeSemanticGraph(structuredClone(encodeSemanticGraph(root,new SemanticContext(),[file],{
        references:index,resolutions
    })));
    assert.deepEqual(decoded.resolutions?.all.map(r=>r.kind),
        ['builtin','unresolved','deferred','monadicOperator']);
    assert.equal(decoded.resolutions?.all[0]?.kind,'builtin');
    if(decoded.resolutions?.all[0]?.kind==='builtin')
        assert.equal(decoded.resolutions.all[0].builtin,builtin);
    for(const resolution of decoded.resolutions?.all??[])
        assert.equal(decoded.references?.lookup(resolution.reference.identifier),resolution.reference);
});

test('new semantic model fields cannot silently disappear from transport',()=>{
    const f=fixture();
    const brokenType={kind:SemanticTypeKind.Fixed,precision:15,newFlag:true} as unknown as SemanticType;
    const symbol:DataObjectSymbol={kind:SymbolKind.DataObject,name:value('X',0),
        type:brokenType,assignmentProtected:false,global:undefined};
    const ctx=new SemanticContext(undefined,new Map([[symbol.name,symbol]]));
    assert.throws(()=>encodeSemanticGraph(f.root,ctx,[file]),/Unsupported semantic type field/);
    const other:DataObjectSymbol={...symbol,type:{kind:SemanticTypeKind.Fixed,precision:15}};
    const extra={...other,unexpectedMetadata:'not transported'} as DataObjectSymbol;
    const ctx2=new SemanticContext(undefined,new Map([[other.name,extra]]));
    assert.throws(()=>encodeSemanticGraph(f.root,ctx2,[file]),/Unsupported semantic symbol field/);
});
