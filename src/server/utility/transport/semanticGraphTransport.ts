// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstNode } from '../../ast/astNode';
import type { ConstantFixedExpressionNode } from '../../ast/problem/expressions/constantFixedExpressionNode';
import type { ProcedureDeclarationNode } from '../../ast/problem/declarations/procedureDeclarationNode';
import type { ShellCommandNode } from '../../ast/module/shellCommandNode';
import type { ExpressionNode } from '../../ast/problem/expressions/expressionNode';
import type { ModuleNode } from '../../ast/module/moduleNode';
import type { SourceValue } from '../../core/sourceValue';
import type { Location } from '../../core/location';
import type { ProblemTag } from '../../core/problemTag';
import type { Source } from '../../source/source';
import { SemanticContext } from '../../semantic/semanticContext';
import { SemanticTypeKind, type SemanticType, type StructComponentType } from '../../semantic/semanticType';
import { SymbolKind } from '../../semantic/symbolKind';
import type { SemanticSymbol, TypeSymbol, DataObjectSymbol, ProcedureSymbol, TaskSymbol } from '../../semantic/symbol';
import type { SymbolReference } from '../../semantic/symbolReference';
import { SymbolReferenceIndex } from '../../semantic/symbolReferenceIndex';
import type { SymbolReferenceResolution } from '../../semantic/symbolReferenceResolution';
import { SymbolReferenceResolutionIndex } from '../../semantic/symbolReferenceResolutionIndex';
import { SymbolOccurrenceIndex } from '../../semantic/symbolOccurrenceIndex';
import type { SymbolUsage, SymbolAccess } from '../../semantic/symbolUsageIndex';
import { SymbolUsageIndex } from '../../semantic/symbolUsageIndex';
import type { SemanticConstantValue, SemanticInitialValue, FixedConstantValue, TimeConstantValue } from '../../semantic/semanticConstantValue';
import { SemanticConstantKind, SemanticInitialValueKind } from '../../semantic/semanticConstantValue';
import type { SemanticDiagnostic } from '../../semantic/semanticDiagnostic';
import type { ModuleConfiguration } from '../../semantic/moduleConfiguration';
import type { BuiltinDefinition } from '../../semantic/builtins/builtinSignature';
import { lookupBuiltin } from '../../semantic/builtins/builtinCatalog';
import { AstGraphEncoder, decodeAstGraph, type AstGraphWire, type DecodedAstGraph } from './astGraphTransport';
import type { SourceLocationWire } from './sourceGraphTransport';

/**
 * Technical compiler/worker boundary. IDs represent object identity, not
 * spelling, structural equality or editor coordinates. All payloads are
 * structured-cloneable, but never contain live compiler objects.
 *
 * The two recursive registries are intentional: REF Node and TYPE Node can
 * produce Symbol -> Type -> Symbol cycles. Decoding allocates their plain data
 * records first, then populates them using the same identity tables.
 */
export const SEMANTIC_GRAPH_TRANSPORT_VERSION = 1 as const;

type TypePayload =
    | { readonly kind: SemanticTypeKind.Fixed | SemanticTypeKind.Float; readonly precision?: number }
    | { readonly kind: SemanticTypeKind.Bit | SemanticTypeKind.Character; readonly length?: number }
    | { readonly kind: SemanticTypeKind.Clock | SemanticTypeKind.Duration | SemanticTypeKind.Sema
        | SemanticTypeKind.Bolt | SemanticTypeKind.Interrupt | SemanticTypeKind.Task }
    | { readonly kind: SemanticTypeKind.Dation; readonly direction?: 'IN' | 'OUT' | 'INOUT'; readonly dationClass: 'ALPHIC' | 'BASIC' | 'ALL' }
    | { readonly kind: SemanticTypeKind.Array; readonly element: number; readonly dimensions: readonly { readonly lower: string; readonly upper: string }[] }
    | { readonly kind: SemanticTypeKind.VirtualArray; readonly element: number; readonly rank: number }
    | { readonly kind: SemanticTypeKind.Struct; readonly components: readonly { readonly name: number; readonly type: number }[] }
    | { readonly kind: SemanticTypeKind.Reference; readonly target: number; readonly targetInvariant: boolean }
    | { readonly kind: SemanticTypeKind.Named; readonly symbol: number }
    | { readonly kind: SemanticTypeKind.VoidReference; readonly targetInvariant: boolean }
    | { readonly kind: SemanticTypeKind.Procedure; readonly parameters: readonly { readonly type?: number; readonly byIdentification: boolean; readonly assignmentProtected: boolean }[];
        readonly hasResult: boolean; readonly resultType?: number; readonly callingConvention: 'PEARL' | 'C' };

export interface SemanticTypeNodeWire { readonly id: number; readonly payload: TypePayload }

export interface SemanticSymbolNodeWire {
    readonly id: number;
    readonly kind: SymbolKind;
    readonly name: number;
    readonly definition?: number;
    readonly global?: boolean;
    readonly type?: number;
    readonly declarationScope?: number;
    readonly assignmentProtected?: boolean;
    readonly hasInitializationAttribute?: boolean;
    readonly systemDationSpecification?: boolean;
    readonly containingType?: number;
    readonly byIdentification?: boolean;
    readonly resultType?: number;
    readonly signature?: number;
    readonly main?: boolean;
}

export interface SymbolReferenceNodeWire {
    readonly id: number;
    readonly identifier: number;
    readonly kind: SymbolReference['kind'];
    readonly node: number;
}

type ConstantWire =
    | { readonly kind: SemanticConstantKind.Fixed; readonly value: string }
    | { readonly kind: SemanticConstantKind.Float; readonly literal: string }
    | { readonly kind: SemanticConstantKind.Bit; readonly bits: string }
    | { readonly kind: SemanticConstantKind.Character; readonly value: string }
    | { readonly kind: SemanticConstantKind.Clock; readonly coefficient: string; readonly scale: number }
    | { readonly kind: SemanticConstantKind.Duration; readonly coefficient: string; readonly scale: number };

type InitialWire =
    | { readonly kind: SemanticInitialValueKind.Constant; readonly values: readonly ConstantWire[]; readonly elementCount: string }
    | { readonly kind: SemanticInitialValueKind.Reference; readonly values: readonly (number | null)[]; readonly elementCount: string };

interface DiagnosticWire {
    readonly code: SemanticDiagnostic['code'];
    readonly severity: SemanticDiagnostic['severity'];
    readonly message: string;
    readonly location: SourceLocationWire;
    readonly lexicalLocation?: SourceLocationWire;
    readonly tags?: readonly ProblemTag[];
    readonly relatedLocations?: readonly { readonly location: SourceLocationWire; readonly message: string }[];
}

interface ModuleConfigurationWire {
    readonly modes: readonly number[];
    readonly timeResolution: { readonly numerator: string; readonly denominator: string };
    readonly fullCharacterComparison: boolean;
    readonly noLineStop: boolean;
    readonly padding: boolean;
    readonly debugInformation: boolean;
    readonly processor?: ModuleConfiguration['processor'];
    readonly moduleSize?: { readonly size: string; readonly clearOnLoad: boolean; readonly codeAddress?: string; readonly varAddress?: string };
    readonly setLine?: ModuleConfiguration['setLine'];
    readonly maxErrors?: number;
}

interface UsageWire {
    readonly symbol: number;
    readonly declaration: number;
    readonly references: readonly number[];
    readonly accesses: readonly { readonly kind: SymbolAccess['kind']; readonly reference?: number }[];
    readonly read: boolean;
    readonly written: boolean;
    readonly addressTaken: boolean;
    readonly uncertain: boolean;
    readonly initialized: boolean;
    readonly externallyVisible: boolean;
    readonly implicitlyUsed: boolean;
    readonly unused: boolean;
}

export interface SemanticContextWire {
    readonly typeDefinitions: readonly (readonly [number, number])[];
    readonly bindings: readonly (readonly [number, number])[];
    readonly builtinBindings: readonly (readonly [number, string])[];
    readonly monadicOperatorBindings: readonly number[];
    readonly referenceInitializerIdentifiers: readonly number[];
    readonly diagnostics: readonly DiagnosticWire[];
    readonly expressionTypes: readonly (readonly [number, number])[];
    readonly constantFixedExpressionValues: readonly (readonly [number, ConstantWire])[];
    readonly namedConstantValues: readonly (readonly [number, ConstantWire])[];
    readonly initialValues: readonly (readonly [number, InitialWire])[];
    readonly constantFixedValues: readonly (readonly [number, ConstantWire])[];
    readonly timeConstantValues: readonly (readonly [number, ConstantWire])[];
    readonly semaPresetValues: readonly (readonly [number, readonly ConstantWire[]])[];
    readonly moduleConfigurations: readonly (readonly [number, ModuleConfigurationWire])[];
    readonly shellCommandsByProcedure: readonly (readonly [number, number])[];
    readonly localSpecificationRelations: readonly (readonly [number, { readonly kind: 'PROC' | 'TASK'; readonly specification: number; readonly definition: number }])[];
    readonly symbolUsages: readonly UsageWire[];
    readonly nameAccessProtections: readonly (readonly [number, boolean])[];
}

type ResolutionWire =
    | { readonly kind: 'bound'; readonly reference: number; readonly symbol: number;
        readonly declaration: number; readonly diagnostics: readonly DiagnosticWire[] }
    | { readonly kind: 'builtin'; readonly reference: number; readonly builtin: string;
        readonly diagnostics: readonly DiagnosticWire[] }
    | { readonly kind: 'monadicOperator' | 'unresolved'; readonly reference: number;
        readonly diagnostics: readonly DiagnosticWire[] }
    | { readonly kind: 'deferred'; readonly reference: number; readonly reason: 'structuralName';
        readonly diagnostics: readonly DiagnosticWire[] };

export interface SemanticIndexWire {
    readonly references: readonly number[];
    readonly resolutions: readonly ResolutionWire[];
}

export interface SemanticIndexInput {
    readonly references: SymbolReferenceIndex;
    readonly resolutions: SymbolReferenceResolutionIndex;
}

export interface SemanticGraphWire {
    readonly version: typeof SEMANTIC_GRAPH_TRANSPORT_VERSION;
    readonly ast: AstGraphWire;
    readonly types: readonly SemanticTypeNodeWire[];
    readonly symbols: readonly SemanticSymbolNodeWire[];
    readonly references: readonly SymbolReferenceNodeWire[];
    readonly context: SemanticContextWire;
    readonly indices?: SemanticIndexWire;
}

export interface DecodedSemanticGraph {
    readonly ast: DecodedAstGraph;
    readonly context: SemanticContext;
    readonly references?: SymbolReferenceIndex;
    readonly resolutions?: SymbolReferenceResolutionIndex;
    readonly occurrences?: SymbolOccurrenceIndex;
    resolveSymbol(id: number): SemanticSymbol;
    resolveType(id: number): SemanticType;
    resolveReference(id: number): SymbolReference;
}

function big(value: bigint): string { return value.toString(10); }
function unbig(value: string): bigint {
    if (typeof value !== 'string' || !/^-?(0|[1-9][0-9]*)$/.test(value)) throw new Error('Invalid semantic bigint');
    return BigInt(value);
}
function validId(id: number): boolean { return Number.isSafeInteger(id) && id > 0; }
/** New model fields must not silently disappear in the worker transport. */
function requireSupportedFields(value: object, fields: readonly string[], label: string): void {
    const allowed = new Set(fields);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) throw new Error(`Unsupported ${label} field at transport boundary: ${key}`);
    }
}
function requireTypeFields(type: SemanticType): void {
    const shared=['kind'];
    switch(type.kind){
        case SemanticTypeKind.Fixed:case SemanticTypeKind.Float:
            return requireSupportedFields(type,[...shared,'precision'],'semantic type');
        case SemanticTypeKind.Bit:case SemanticTypeKind.Character:
            return requireSupportedFields(type,[...shared,'length'],'semantic type');
        case SemanticTypeKind.Clock:case SemanticTypeKind.Duration:case SemanticTypeKind.Sema:
        case SemanticTypeKind.Bolt:case SemanticTypeKind.Interrupt:case SemanticTypeKind.Task:
            return requireSupportedFields(type,shared,'semantic type');
        case SemanticTypeKind.Dation:
            return requireSupportedFields(type,[...shared,'direction','dationClass'],'semantic type');
        case SemanticTypeKind.Array:
            return requireSupportedFields(type,[...shared,'elementType','dimensions'],'semantic type');
        case SemanticTypeKind.VirtualArray:
            return requireSupportedFields(type,[...shared,'elementType','rank'],'semantic type');
        case SemanticTypeKind.Struct:
            return requireSupportedFields(type,[...shared,'components'],'semantic type');
        case SemanticTypeKind.Reference:
            return requireSupportedFields(type,[...shared,'target','targetInvariant'],'semantic type');
        case SemanticTypeKind.Named:
            return requireSupportedFields(type,[...shared,'symbol'],'semantic type');
        case SemanticTypeKind.VoidReference:
            return requireSupportedFields(type,[...shared,'targetInvariant'],'semantic type');
        case SemanticTypeKind.Procedure:
            return requireSupportedFields(type,[...shared,'parameters','hasResult','resultType','callingConvention'],'semantic type');
    }
}
function requireSymbolFields(symbol:SemanticSymbol):void {
    const base=['kind','name','definition'];
    switch(symbol.kind){
        case SymbolKind.Module:case SymbolKind.Type:case SymbolKind.Format:case SymbolKind.Label:
            return requireSupportedFields(symbol,base,'semantic symbol');
        case SymbolKind.DataObject:
            return requireSupportedFields(symbol,[...base,'global','type','declarationScope',
                'assignmentProtected','hasInitializationAttribute','systemDationSpecification'],'semantic symbol');
        case SymbolKind.StructComponent:
            return requireSupportedFields(symbol,[...base,'type','containingType'],'semantic symbol');
        case SymbolKind.Parameter:case SymbolKind.Identification:
            return requireSupportedFields(symbol,[...base,'type','assignmentProtected','byIdentification'],'semantic symbol');
        case SymbolKind.Procedure:
            return requireSupportedFields(symbol,[...base,'global','resultType','signature'],'semantic symbol');
        case SymbolKind.Task:
            return requireSupportedFields(symbol,[...base,'global','main'],'semantic symbol');
        case SymbolKind.LoopControlVariable:
            return requireSupportedFields(symbol,[...base,'type'],'semantic symbol');
    }
}

function decodePairs<K,V>(entries: readonly (readonly [number, number])[], key: (id:number)=>K, value: (id:number)=>V): Map<K,V> {
    if (!Array.isArray(entries)) throw new Error('Invalid semantic map');
    const result = new Map<K,V>();
    for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid semantic map entry');
        const k = key(entry[0]);
        if (result.has(k)) throw new Error('Duplicate semantic map key');
        result.set(k, value(entry[1]));
    }
    return result;
}

export class SemanticGraphEncoder {
    readonly ast: AstGraphEncoder;
    private readonly typeIds = new Map<SemanticType, number>();
    private readonly typeRecords: SemanticTypeNodeWire[] = [];
    private readonly symbolIds = new Map<SemanticSymbol, number>();
    private readonly symbolRecords: SemanticSymbolNodeWire[] = [];
    private readonly referenceIds = new Map<SymbolReference, number>();
    private readonly referenceRecords: SymbolReferenceNodeWire[] = [];

    constructor(ast = new AstGraphEncoder()) { this.ast = ast; }
    private value(v: SourceValue<unknown>): number { return this.ast.sourceValues.encode(v); }
    private node(n: AstNode): number { return this.ast.encode(n); }

    encodeType(type: SemanticType): number {
        requireTypeFields(type);
        const old = this.typeIds.get(type);
        if (old !== undefined) return old;
        const id = this.typeRecords.length + 1;
        this.typeIds.set(type, id);
        this.typeRecords.push(undefined as unknown as SemanticTypeNodeWire);
        let payload: TypePayload;
        switch (type.kind) {
            case SemanticTypeKind.Fixed:
            case SemanticTypeKind.Float: payload = { kind: type.kind, ...(type.precision === undefined ? {} : {precision:type.precision}) }; break;
            case SemanticTypeKind.Bit:
            case SemanticTypeKind.Character: payload = { kind: type.kind, ...(type.length === undefined ? {} : {length:type.length}) }; break;
            case SemanticTypeKind.Clock: case SemanticTypeKind.Duration: case SemanticTypeKind.Sema:
            case SemanticTypeKind.Bolt: case SemanticTypeKind.Interrupt: case SemanticTypeKind.Task:
                payload = { kind: type.kind }; break;
            case SemanticTypeKind.Dation: payload = { kind: type.kind, dationClass: type.dationClass,
                ...(type.direction === undefined ? {} : {direction:type.direction}) }; break;
            case SemanticTypeKind.Array: payload = { kind:type.kind, element:this.encodeType(type.elementType),
                dimensions:type.dimensions.map(d => ({lower:big(d.lowerBound),upper:big(d.upperBound)})) }; break;
            case SemanticTypeKind.VirtualArray: payload = { kind:type.kind, element:this.encodeType(type.elementType),rank:type.rank }; break;
            case SemanticTypeKind.Struct: payload = { kind:type.kind,
                components:type.components.map(c=>({name:this.value(c.name),type:this.encodeType(c.type)})) }; break;
            case SemanticTypeKind.Reference: payload = {kind:type.kind,target:this.encodeType(type.target),targetInvariant:type.targetInvariant}; break;
            case SemanticTypeKind.Named: payload = {kind:type.kind,symbol:this.encodeSymbol(type.symbol)}; break;
            case SemanticTypeKind.VoidReference: payload = {kind:type.kind,targetInvariant:type.targetInvariant}; break;
            case SemanticTypeKind.Procedure: payload = {kind:type.kind,
                parameters:type.parameters.map(p=>({...(p.type===undefined?{}:{type:this.encodeType(p.type)}),
                    byIdentification:p.byIdentification,assignmentProtected:p.assignmentProtected})),
                hasResult:type.hasResult, ...(type.resultType===undefined?{}:{resultType:this.encodeType(type.resultType)}),
                callingConvention:type.callingConvention }; break;
            default: { const impossible: never = type; throw new Error(`Unsupported semantic type: ${String(impossible)}`); }
        }
        this.typeRecords[id-1] = {id,payload};
        return id;
    }

    encodeSymbol(symbol: SemanticSymbol): number {
        requireSymbolFields(symbol);
        const old = this.symbolIds.get(symbol);
        if (old !== undefined) return old;
        const id = this.symbolRecords.length+1;
        this.symbolIds.set(symbol,id);
        this.symbolRecords.push(undefined as unknown as SemanticSymbolNodeWire);
        const base: SemanticSymbolNodeWire = {id,kind:symbol.kind,name:this.value(symbol.name),
            ...(symbol.definition === undefined ? {} : {definition:this.value(symbol.definition)})};
        let record: SemanticSymbolNodeWire;
        switch(symbol.kind) {
            case SymbolKind.Module: case SymbolKind.Type: case SymbolKind.Format: case SymbolKind.Label:
                record = base; break;
            case SymbolKind.DataObject:
                record = {...base,global:!!symbol.global,type:this.encodeType(symbol.type),
                    assignmentProtected:symbol.assignmentProtected,
                    ...(symbol.declarationScope===undefined?{}:{declarationScope:symbol.declarationScope}),
                    ...(symbol.hasInitializationAttribute===undefined?{}:{hasInitializationAttribute:symbol.hasInitializationAttribute}),
                    ...(symbol.systemDationSpecification===undefined?{}:{systemDationSpecification:symbol.systemDationSpecification})}; break;
            case SymbolKind.StructComponent: record = {...base,type:this.encodeType(symbol.type),
                ...(symbol.containingType===undefined?{}:{containingType:this.encodeType(symbol.containingType)})}; break;
            case SymbolKind.Parameter: case SymbolKind.Identification:
                record = {...base,assignmentProtected:symbol.assignmentProtected,byIdentification:symbol.byIdentification,
                    ...(symbol.type===undefined?{}:{type:this.encodeType(symbol.type)})}; break;
            case SymbolKind.Procedure:
                record = {...base,global:!!symbol.global,
                    ...(symbol.resultType===undefined?{}:{resultType:this.encodeType(symbol.resultType)}),
                    ...(symbol.signature===undefined?{}:{signature:this.encodeType(symbol.signature)})}; break;
            case SymbolKind.Task: record = {...base,global:!!symbol.global,...(symbol.main===undefined?{}:{main:symbol.main})}; break;
            case SymbolKind.LoopControlVariable: record = {...base,type:this.encodeType(symbol.type)}; break;
            default: { const impossible: never = symbol; throw new Error(`Unsupported semantic symbol: ${String(impossible)}`); }
        }
        this.symbolRecords[id-1]=record;
        return id;
    }

    encodeReference(reference: SymbolReference): number {
        const old = this.referenceIds.get(reference);
        if (old !== undefined) return old;
        const id=this.referenceRecords.length+1;
        this.referenceIds.set(reference,id);
        this.referenceRecords.push({id,identifier:this.value(reference.identifier),kind:reference.kind,node:this.node(reference.node)});
        return id;
    }

    private encodeConstant(c: SemanticConstantValue): ConstantWire {
        switch(c.kind) {
            case SemanticConstantKind.Fixed: return {kind:c.kind,value:big(c.value)};
            case SemanticConstantKind.Float: return {kind:c.kind,literal:c.literal};
            case SemanticConstantKind.Bit: return {kind:c.kind,bits:c.bits};
            case SemanticConstantKind.Character: return {kind:c.kind,value:c.value};
            case SemanticConstantKind.Clock: return {kind:c.kind,coefficient:big(c.secondsSinceMidnight.coefficient),scale:c.secondsSinceMidnight.scale};
            case SemanticConstantKind.Duration: return {kind:c.kind,coefficient:big(c.seconds.coefficient),scale:c.seconds.scale};
        }
    }
    private encodeInitial(initial: SemanticInitialValue): InitialWire {
        if(initial.kind===SemanticInitialValueKind.Constant) return {kind:initial.kind,elementCount:big(initial.elementCount),
            values:initial.values.map(v=>this.encodeConstant(v))};
        return {kind:initial.kind,elementCount:big(initial.elementCount),values:initial.values.map(v=>v===null?null:this.encodeSymbol(v))};
    }
    private encodeDiagnostic(d: SemanticDiagnostic): DiagnosticWire {
        const sources = this.ast.sourceValues.sources;
        return {code:d.code,severity:d.severity,message:d.message,location:sources.encodeLocation(d.location),
            ...(d.lexicalLocation===undefined?{}:{lexicalLocation:sources.encodeLocation(d.lexicalLocation)}),
            ...(d.tags===undefined?{}:{tags:[...d.tags]}),
            ...(d.relatedLocations===undefined?{}:{relatedLocations:d.relatedLocations.map(r=>({message:r.message,location:sources.encodeLocation(r.location)}))})};
    }
    private encodeModule(config:ModuleConfiguration): ModuleConfigurationWire {
        const size=config.moduleSize;
        return { modes:config.modes.map(v=>this.value(v)),
            timeResolution:{numerator:big(config.timeResolution.numerator),denominator:big(config.timeResolution.denominator)},
            fullCharacterComparison:config.fullCharacterComparison,noLineStop:config.noLineStop,padding:config.padding,
            debugInformation:config.debugInformation,
            ...(config.processor===undefined?{}:{processor:{...config.processor}}),
            ...(size===undefined?{}:{moduleSize:{size:big(size.size),clearOnLoad:size.clearOnLoad,
                ...(size.codeAddress===undefined?{}:{codeAddress:big(size.codeAddress)}),
                ...(size.varAddress===undefined?{}:{varAddress:big(size.varAddress)})}}),
            ...(config.setLine===undefined?{}:{setLine:{...config.setLine}}),
            ...(config.maxErrors===undefined?{}:{maxErrors:config.maxErrors})};
    }
    private builtinName(builtin:BuiltinDefinition):string {
        if (lookupBuiltin(builtin.name)!==builtin) throw new Error(`Unregistered builtin at transport boundary: ${builtin.name}`);
        return builtin.name;
    }
    private encodeResolution(r:SymbolReferenceResolution):ResolutionWire {
        const base={reference:this.encodeReference(r.reference),diagnostics:r.diagnostics.map(d=>this.encodeDiagnostic(d))};
        switch(r.kind){
            case 'bound':return {...base,kind:r.kind,symbol:this.encodeSymbol(r.symbol),declaration:this.value(r.declaration)};
            case 'builtin':return {...base,kind:r.kind,builtin:this.builtinName(r.builtin)};
            case 'monadicOperator':case 'unresolved':return {...base,kind:r.kind};
            case 'deferred':return {...base,kind:r.kind,reason:r.reason};
        }
    }
    private encodeUsage(usage:SymbolUsage):UsageWire {
        return {symbol:this.encodeSymbol(usage.symbol),declaration:this.value(usage.declaration),
            references:usage.references.map(ref=>this.encodeReference(ref)),
            accesses:usage.accesses.map(a=>({kind:a.kind,...(a.reference===undefined?{}:{reference:this.encodeReference(a.reference)})})),
            read:usage.read,written:usage.written,addressTaken:usage.addressTaken,uncertain:usage.uncertain,
            initialized:usage.initialized,externallyVisible:usage.externallyVisible,
            implicitlyUsed:usage.implicitlyUsed,unused:usage.unused};
    }

    /** The AST root is encoded first so semantic node references share its IDs. */
    encode(root:AstNode, context:SemanticContext, sources:readonly Source[]=[], indices?:SemanticIndexInput):SemanticGraphWire {
        this.node(root);
        const v=(x:SourceValue<unknown>)=>this.value(x);
        const n=(x:AstNode)=>this.node(x);
        const s=(x:SemanticSymbol)=>this.encodeSymbol(x);
        const t=(x:SemanticType)=>this.encodeType(x);
        const map=<K,V,R>(entries:ReadonlyMap<K,V>, key:(x:K)=>number, value:(x:V)=>R):readonly (readonly [number,R])[] =>
            [...entries].map(([k,val]):readonly [number,R]=>[key(k),value(val)]);
        const contextWire:SemanticContextWire={
            typeDefinitions:map(context.typeDefinitions,s,t),
            bindings:map(context.bindings,v,s),
            builtinBindings:map(context.builtinBindings,v,b=>this.builtinName(b)),
            monadicOperatorBindings:[...context.monadicOperatorBindings].map(v),
            referenceInitializerIdentifiers:[...context.referenceInitializerIdentifiers].map(v),
            diagnostics:context.diagnostics.map(d=>this.encodeDiagnostic(d)),
            expressionTypes:map(context.expressionTypes,n,t),
            constantFixedExpressionValues:map(context.constantFixedExpressionValues,n,c=>this.encodeConstant(c)),
            namedConstantValues:map(context.namedConstantValues,s,c=>this.encodeConstant(c)),
            initialValues:map(context.initialValues,s,i=>this.encodeInitial(i)),
            constantFixedValues:map(context.constantFixedValues,n,c=>this.encodeConstant(c)),
            timeConstantValues:map(context.timeConstantValues,n,c=>this.encodeConstant(c)),
            semaPresetValues:map(context.semaPresetValues,s,a=>a.map(c=>this.encodeConstant(c))),
            moduleConfigurations:map(context.moduleConfigurations,n,c=>this.encodeModule(c)),
            shellCommandsByProcedure:map(context.shellCommandsByProcedure,n,n),
            localSpecificationRelations:map(context.localSpecificationRelations,v,r=>({kind:r.kind,specification:v(r.specification),definition:v(r.definition)})),
            symbolUsages:context.symbolUsages.all.map(u=>this.encodeUsage(u)),
            nameAccessProtections:map(context.nameAccessProtections,v,b=>b)
        };
        const indexWire:SemanticIndexWire|undefined=indices===undefined?undefined:{
            references:indices.references.all.map(ref=>this.encodeReference(ref)),
            resolutions:indices.resolutions.all.map(r=>this.encodeResolution(r))
        };
        return { version: SEMANTIC_GRAPH_TRANSPORT_VERSION, ast:this.ast.finish(root,sources),
            types:[...this.typeRecords],symbols:[...this.symbolRecords],references:[...this.referenceRecords],context:contextWire,
            ...(indexWire===undefined?{}:{indices:indexWire})};
    }
}

export function encodeSemanticGraph(root:AstNode, context:SemanticContext, sources:readonly Source[]=[],
    indices?:SemanticIndexInput):SemanticGraphWire {
    return new SemanticGraphEncoder().encode(root,context,sources,indices);
}

/** Separate contexts share one AST / SourceValue / symbol / type identity space. */
export interface SemanticGraphContextEntryWire {
    readonly context: SemanticContextWire;
    readonly indices?: SemanticIndexWire;
}

export type DecodedSemanticContextEntry = Pick<DecodedSemanticGraph,
    'context' | 'references' | 'resolutions' | 'occurrences'>;

export interface DecodedSemanticGraphBundle {
    readonly ast: DecodedAstGraph;
    readonly entries: readonly DecodedSemanticContextEntry[];
    resolveSymbol(id: number): SemanticSymbol;
    resolveType(id: number): SemanticType;
    resolveReference(id: number): SymbolReference;
}

/** Decode all entries in one session. Calling decodeSemanticGraph repeatedly would
 *  duplicate AST, SourceValue and semantic identities across analyses. */
export function decodeSemanticGraphBundle(
    wire: SemanticGraphWire,
    entries: readonly SemanticGraphContextEntryWire[]
): DecodedSemanticGraphBundle {
    if(wire.version!==SEMANTIC_GRAPH_TRANSPORT_VERSION || !Array.isArray(wire.types)
        || !Array.isArray(wire.symbols) || !Array.isArray(wire.references) || !wire.context) {
        throw new Error('Unsupported or malformed semantic graph transport version');
    }
    const ast=decodeAstGraph(wire.ast);
    const values=ast.sourceValues;
    const v=(id:number)=>values.resolve(id) as SourceValue<string>;
    const n=(id:number)=>ast.resolve(id);
    const typeWire=new Map<number,SemanticTypeNodeWire>();
    const symbolWire=new Map<number,SemanticSymbolNodeWire>();
    const refWire=new Map<number,SymbolReferenceNodeWire>();
    for(const record of wire.types) {
        if(!validId(record.id)||typeWire.has(record.id))throw new Error('Duplicate or invalid semantic type ID');
        typeWire.set(record.id,record);
    }
    for(const record of wire.symbols) {
        if(!validId(record.id)||symbolWire.has(record.id))throw new Error('Duplicate or invalid semantic symbol ID');
        symbolWire.set(record.id,record);
    }
    for(const record of wire.references) {
        if(!validId(record.id)||refWire.has(record.id))throw new Error('Duplicate or invalid semantic reference ID');
        refWire.set(record.id,record);
    }
    const types=new Map<number,SemanticType>();
    const symbols=new Map<number,SemanticSymbol>();
    const refs=new Map<number,SymbolReference>();
    const requireNumber=(id:number|undefined,label:string):number=>{
        if(!validId(id!))throw new Error(`Missing semantic ${label} ID`);
        return id!;
    };
    function resolveType(id:number):SemanticType {
        const existing=types.get(id);
        if(existing)return existing;
        const record=typeWire.get(id);
        if(!record)throw new Error(`Missing semantic type identity: ${id}`);
        // Plain semantic types carry no prototype; allocating before recursion
        // retains cycles through named types and type symbols.
        const target={} as SemanticType;
        types.set(id,target);
        const p=record.payload;
        let decoded:SemanticType;
        switch(p.kind){
            case SemanticTypeKind.Fixed:case SemanticTypeKind.Float: decoded={kind:p.kind,precision:p.precision};break;
            case SemanticTypeKind.Bit:case SemanticTypeKind.Character: decoded={kind:p.kind,length:p.length};break;
            case SemanticTypeKind.Clock:case SemanticTypeKind.Duration:case SemanticTypeKind.Sema:
            case SemanticTypeKind.Bolt:case SemanticTypeKind.Interrupt:case SemanticTypeKind.Task: decoded={kind:p.kind};break;
            case SemanticTypeKind.Dation:decoded={kind:p.kind,direction:p.direction,dationClass:p.dationClass};break;
            case SemanticTypeKind.Array:decoded={kind:p.kind,elementType:resolveType(p.element),
                dimensions:p.dimensions.map(d=>({lowerBound:unbig(d.lower),upperBound:unbig(d.upper)}))};break;
            case SemanticTypeKind.VirtualArray:decoded={kind:p.kind,elementType:resolveType(p.element),rank:p.rank};break;
            case SemanticTypeKind.Struct:decoded={kind:p.kind,components:p.components.map((c):StructComponentType=>({name:v(c.name),type:resolveType(c.type)}))};break;
            case SemanticTypeKind.Reference:decoded={kind:p.kind,target:resolveType(p.target),targetInvariant:p.targetInvariant};break;
            case SemanticTypeKind.Named:decoded={kind:p.kind,symbol:resolveSymbol(p.symbol) as TypeSymbol};break;
            case SemanticTypeKind.VoidReference:decoded={kind:p.kind,targetInvariant:p.targetInvariant};break;
            case SemanticTypeKind.Procedure:decoded={kind:p.kind,
                parameters:p.parameters.map(param=>({type:param.type===undefined?undefined:resolveType(param.type),
                    byIdentification:param.byIdentification,assignmentProtected:param.assignmentProtected})),
                hasResult:p.hasResult,resultType:p.resultType===undefined?undefined:resolveType(p.resultType),
                callingConvention:p.callingConvention};break;
            default:throw new Error('Unsupported semantic type kind');
        }
        Object.assign(target,decoded);
        return target;
    }
    function resolveSymbol(id:number):SemanticSymbol {
        const existing=symbols.get(id);
        if(existing)return existing;
        const r=symbolWire.get(id);
        if(!r)throw new Error(`Missing semantic symbol identity: ${id}`);
        const target={} as SemanticSymbol;
        symbols.set(id,target);
        const base={kind:r.kind,name:v(r.name),...(r.definition===undefined?{}:{definition:v(r.definition)})};
        let decoded:SemanticSymbol;
        switch(r.kind){
            case SymbolKind.Module:case SymbolKind.Type:case SymbolKind.Format:case SymbolKind.Label:
                decoded=base as SemanticSymbol;break;
            case SymbolKind.DataObject:decoded={...base,kind:r.kind,type:resolveType(requireNumber(r.type,'data type')),
                global:r.global?{kind:'global'}:undefined,assignmentProtected:r.assignmentProtected===true,
                ...(r.declarationScope===undefined?{}:{declarationScope:r.declarationScope}),
                ...(r.hasInitializationAttribute===undefined?{}:{hasInitializationAttribute:r.hasInitializationAttribute}),
                ...(r.systemDationSpecification===undefined?{}:{systemDationSpecification:r.systemDationSpecification})} as DataObjectSymbol;break;
            case SymbolKind.StructComponent:decoded={...base,kind:r.kind,type:resolveType(requireNumber(r.type,'component type')),
                ...(r.containingType===undefined?{}:{containingType:resolveType(r.containingType)})};break;
            case SymbolKind.Parameter:case SymbolKind.Identification:decoded={...base,kind:r.kind,
                assignmentProtected:r.assignmentProtected===true,byIdentification:r.byIdentification===true,
                ...(r.type===undefined?{}:{type:resolveType(r.type)})};break;
            case SymbolKind.Procedure:decoded={...base,kind:r.kind,global:r.global?{kind:'global'}:undefined,
                ...(r.resultType===undefined?{}:{resultType:resolveType(r.resultType)}),
                ...(r.signature===undefined?{}:{signature:resolveType(r.signature)})} as ProcedureSymbol;break;
            case SymbolKind.Task:decoded={...base,kind:r.kind,global:r.global?{kind:'global'}:undefined,
                ...(r.main===undefined?{}:{main:r.main})} as TaskSymbol;break;
            case SymbolKind.LoopControlVariable:decoded={...base,kind:r.kind,type:resolveType(requireNumber(r.type,'loop variable type')) as Extract<SemanticType,{kind:SemanticTypeKind.Fixed}>};break;
            default:throw new Error(`Unsupported semantic symbol kind: ${r.kind}`);
        }
        Object.assign(target,decoded);
        return target;
    }
    function resolveReference(id:number):SymbolReference {
        const existing=refs.get(id);
        if(existing)return existing;
        const r=refWire.get(id);
        if(!r)throw new Error(`Missing semantic reference identity: ${id}`);
        const ref:SymbolReference={identifier:v(r.identifier),kind:r.kind,node:n(r.node)};
        refs.set(id,ref);
        return ref;
    }
    const decodeConstant=(c:ConstantWire):SemanticConstantValue=>{
        switch(c.kind){
            case SemanticConstantKind.Fixed:return {kind:c.kind,value:unbig(c.value)};
            case SemanticConstantKind.Float:return {kind:c.kind,literal:c.literal};
            case SemanticConstantKind.Bit:return {kind:c.kind,bits:c.bits};
            case SemanticConstantKind.Character:return {kind:c.kind,value:c.value};
            case SemanticConstantKind.Clock:return {kind:c.kind,secondsSinceMidnight:{coefficient:unbig(c.coefficient),scale:c.scale}};
            case SemanticConstantKind.Duration:return {kind:c.kind,seconds:{coefficient:unbig(c.coefficient),scale:c.scale}};
            default:throw new Error('Unsupported semantic constant kind');
        }
    };
    const decodeInitial=(i:InitialWire):SemanticInitialValue=>{
        if(i.kind===SemanticInitialValueKind.Constant)return {kind:i.kind,elementCount:unbig(i.elementCount),values:i.values.map(decodeConstant)};
        if(i.kind===SemanticInitialValueKind.Reference)return {kind:i.kind,elementCount:unbig(i.elementCount),
            values:i.values.map(id=>id===null?null:resolveSymbol(id) as DataObjectSymbol|ProcedureSymbol|TaskSymbol)};
        throw new Error('Unsupported semantic initial value kind');
    };
    const decodeDiagnostic=(d:DiagnosticWire):SemanticDiagnostic=>({
        code:d.code,severity:d.severity,message:d.message,location:values.sources.decodeLocation(d.location),
        ...(d.lexicalLocation===undefined?{}:{lexicalLocation:values.sources.decodeLocation(d.lexicalLocation)}),
        ...(d.tags===undefined?{}:{tags:[...d.tags]}),
        ...(d.relatedLocations===undefined?{}:{relatedLocations:d.relatedLocations.map(r=>({message:r.message,location:values.sources.decodeLocation(r.location)}))})
    });
    const decodeModule=(c:ModuleConfigurationWire):ModuleConfiguration=>({
        modes:c.modes.map(v),timeResolution:{numerator:unbig(c.timeResolution.numerator),denominator:unbig(c.timeResolution.denominator)},
        fullCharacterComparison:c.fullCharacterComparison,noLineStop:c.noLineStop,padding:c.padding,debugInformation:c.debugInformation,
        ...(c.processor===undefined?{}:{processor:{...c.processor}}),
        ...(c.moduleSize===undefined?{}:{moduleSize:{size:unbig(c.moduleSize.size),clearOnLoad:c.moduleSize.clearOnLoad,
            ...(c.moduleSize.codeAddress===undefined?{}:{codeAddress:unbig(c.moduleSize.codeAddress)}),
            ...(c.moduleSize.varAddress===undefined?{}:{varAddress:unbig(c.moduleSize.varAddress)})}}),
        ...(c.setLine===undefined?{}:{setLine:{...c.setLine}}),
        ...(c.maxErrors===undefined?{}:{maxErrors:c.maxErrors})
    });
    const builtin=(name:string):BuiltinDefinition=>{
        const found=lookupBuiltin(name);
        if(!found)throw new Error(`Unknown builtin in semantic transport: ${name}`);
        return found;
    };
    const u=(usage:UsageWire):SymbolUsage=>({
        symbol:resolveSymbol(usage.symbol),declaration:v(usage.declaration),
        references:usage.references.map(resolveReference),
        accesses:usage.accesses.map(a=>({kind:a.kind,...(a.reference===undefined?{}:{reference:resolveReference(a.reference)})})),
        read:usage.read,written:usage.written,addressTaken:usage.addressTaken,uncertain:usage.uncertain,
        initialized:usage.initialized,externallyVisible:usage.externallyVisible,implicitlyUsed:usage.implicitlyUsed,unused:usage.unused
    });
    const map=<K,V>(entries:readonly (readonly [number,number])[], k:(id:number)=>K, val:(id:number)=>V)=>decodePairs(entries,k,val);
    const mapData=<K,V,W>(entries:readonly (readonly [number,W])[], k:(id:number)=>K, val:(w:W)=>V):Map<K,V>=>{
        const result=new Map<K,V>();
        for(const [id,data] of entries){const key=k(id);if(result.has(key))throw new Error('Duplicate semantic map key');result.set(key,val(data));}
        return result;
    };
    const decodeEntry = (entry: SemanticGraphContextEntryWire): DecodedSemanticContextEntry => {
    const c = entry.context;
    const context=new SemanticContext(
        map(c.typeDefinitions,id=>resolveSymbol(id) as TypeSymbol,resolveType),
        map(c.bindings,v,resolveSymbol),
        c.diagnostics.map(decodeDiagnostic),
        mapData(c.constantFixedExpressionValues,id=>n(id) as ConstantFixedExpressionNode,x=>decodeConstant(x) as FixedConstantValue),
        mapData(c.namedConstantValues,id=>resolveSymbol(id) as DataObjectSymbol,decodeConstant),
        mapData(c.initialValues,id=>resolveSymbol(id) as DataObjectSymbol,decodeInitial),
        mapData(c.constantFixedValues,n,x=>decodeConstant(x) as FixedConstantValue),
        mapData(c.timeConstantValues,n,x=>decodeConstant(x) as TimeConstantValue),
        mapData(c.semaPresetValues,id=>resolveSymbol(id) as DataObjectSymbol,a=>a.map(x=>decodeConstant(x) as FixedConstantValue)),
        mapData(c.moduleConfigurations,id=>n(id) as ModuleNode,decodeModule),
        map(c.shellCommandsByProcedure,id=>n(id) as ProcedureDeclarationNode,id=>n(id) as ShellCommandNode),
        mapData(c.builtinBindings,v,builtin),
        mapData(c.localSpecificationRelations,v,r=>({kind:r.kind,specification:v(r.specification),definition:v(r.definition)})),
        map(c.expressionTypes,id=>n(id) as ExpressionNode,resolveType),
        new SymbolUsageIndex(c.symbolUsages.map(u)),
        new Set(c.monadicOperatorBindings.map(v)),
        new Set(c.referenceInitializerIdentifiers.map(v)),
        mapData(c.nameAccessProtections,v,x=>x)
    );
    let referenceIndex:SymbolReferenceIndex|undefined;
    let resolutionIndex:SymbolReferenceResolutionIndex|undefined;
    let occurrenceIndex:SymbolOccurrenceIndex|undefined;
    if(entry.indices!==undefined){
        if(!Array.isArray(entry.indices.references)||!Array.isArray(entry.indices.resolutions))
            throw new Error('Malformed semantic index transport');
        referenceIndex=new SymbolReferenceIndex(entry.indices.references.map(resolveReference));
        const resolutions=entry.indices.resolutions.map((r):SymbolReferenceResolution=>{
            const base={reference:resolveReference(r.reference),diagnostics:r.diagnostics.map(decodeDiagnostic)};
            switch(r.kind){
                case 'bound':return {...base,kind:r.kind,symbol:resolveSymbol(r.symbol),declaration:v(r.declaration)};
                case 'builtin':return {...base,kind:r.kind,builtin:builtin(r.builtin)};
                case 'monadicOperator':case 'unresolved':return {...base,kind:r.kind};
                case 'deferred':return {...base,kind:r.kind,reason:r.reason};
                default:throw new Error('Unsupported semantic resolution kind');
            }
        });
        resolutionIndex=new SymbolReferenceResolutionIndex(resolutions);
        occurrenceIndex=new SymbolOccurrenceIndex(resolutionIndex,context);
    }
    return {context,
        ...(referenceIndex===undefined?{}:{references:referenceIndex}),
        ...(resolutionIndex===undefined?{}:{resolutions:resolutionIndex}),
        ...(occurrenceIndex===undefined?{}:{occurrences:occurrenceIndex})};
    };
    if (!Array.isArray(entries) || !entries.length) {
        throw new Error('Missing semantic graph context entries');
    }
    const decodedEntries = entries.map(decodeEntry);
    // Demand that all records are reachable and decodable, even unused ones.
    for(const id of typeWire.keys())resolveType(id);
    for(const id of symbolWire.keys())resolveSymbol(id);
    for(const id of refWire.keys())resolveReference(id);
    return {ast,entries:decodedEntries,resolveType,resolveSymbol,resolveReference};
}

export function decodeSemanticGraph(wire:SemanticGraphWire):DecodedSemanticGraph {
    const decoded = decodeSemanticGraphBundle(wire, [{context:wire.context, ...(wire.indices === undefined ? {} : {indices:wire.indices})}]);
    return {ast:decoded.ast, ...decoded.entries[0]!, resolveType:decoded.resolveType,
        resolveSymbol:decoded.resolveSymbol, resolveReference:decoded.resolveReference};
}
