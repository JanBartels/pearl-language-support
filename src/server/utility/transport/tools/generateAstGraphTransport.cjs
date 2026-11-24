// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels
// Developer-only generator: emits explicit per-AST-class codecs; never runs in the LSP.
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../..');
const ast = path.join(base, 'ast');
const dest = path.join(base, 'utility/transport/astGraphTransport.ts');
const classes = [];
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory())
        walk(f);
    else if (e.name.endsWith('Node.ts')) {
        let sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
        for (const c of sf.statements.filter(ts.isClassDeclaration)) {
            if (!c.name || c.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword))
                continue;
            let ctor = c.members.find(ts.isConstructorDeclaration);
            if (!ctor)
                continue;
            let name = c.name.text;
            if (['AstNode', 'ExpressionNode', 'SystemDeclarationNode'].includes(name))
                continue;
            let args = ctor.parameters.map(p => ({ name: p.name.getText(sf), type: p.type?.getText(sf) || '', optional: !!p.questionToken }));
            classes.push({ name, kind: name.replace(/Node$/, ''), args, file: f });
        }
    }
} }
walk(ast);
classes.sort((a, b) => a.kind.localeCompare(b.kind));
// Fail at generation time if a new mutable AST property has no explicit field
// or constructor representation. This prevents silent loss of compiler state.
const extras = {
    TranslationUnitNode: new Set(['children']),
    ModuleNode: new Set(['shellCommands', 'systemPart', 'problemPart', 'modendKeyword', 'debugKeyword']),
    ProblemPartNode: new Set(['children']),
    SystemPartNode: new Set(['children'])
};
for (const node of classes) {
    const sf = ts.createSourceFile(node.file, fs.readFileSync(node.file, 'utf8'), ts.ScriptTarget.Latest, true);
    const decl = sf.statements.find(s => ts.isClassDeclaration(s) && s.name?.text === node.name);
    const ctorNames = new Set(node.args.map(a => a.name));
    for (const member of decl.members.filter(ts.isPropertyDeclaration)) {
        if (member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword))
            continue;
        const name = member.name.getText(sf);
        if (!ctorNames.has(name) && !extras[node.name]?.has(name))
            throw new Error(`Unrepresented mutable AST field ${node.name}.${name}`);
    }
}
const specials = {
    ConstantFixedExpressionTail: { operator: 'SourceValue<string>', term: 'ConstantFixedTermNode' },
    ConstantFixedTermTail: { operator: 'SourceValue<string>', factor: 'ConstantFixedFactorNode' },
    ConstantFixedFit: { keyword: 'SourceValue<string>', expression: 'ConstantFixedExpressionNode' },
    DurationConstantComponent: { value: 'SourceValue<string>', unit: 'SourceValue<DurationUnit>' }
};
const variants = {
    ConstantFixedFactorOperand: { integer: { literal: 'SourceValue<string>', precision: 'SourceValue<string> | undefined' }, identifier: { identifier: 'SourceValue<string>' }, parenthesized: { expression: 'ConstantFixedExpressionNode' }, toFixedCharacter: { keyword: 'SourceValue<string>', literal: 'SourceValue<string>' }, toFixedBit: { keyword: 'SourceValue<string>', literal: 'SourceValue<string>' } },
    SignedConstantExpressionOperand: { floatingPoint: { literal: 'SourceValue<string>' }, duration: { constant: 'DurationConstantNode' } },
    InitElementValue: { nil: { keyword: 'SourceValue<string>' }, constantFixedExpression: { expression: 'ConstantFixedExpressionNode' }, identifier: { identifier: 'SourceValue<string>' }, floatingPoint: { literal: 'SourceValue<string>' }, characterString: { literals: 'readonly SourceValue<string>[]' }, bitString: { literal: 'SourceValue<string>' }, clock: { constant: 'ClockConstantNode' }, duration: { constant: 'DurationConstantNode' }, signedConstantExpression: { expression: 'SignedConstantExpressionNode' } }
};
const specialNames = Object.keys({ ...specials, ...variants });
function norm(t) { return t.trim().replace(/^readonly\s+/, '').trim(); }
function unopt(t) { return t.replace(/\s*\|\s*undefined/g, '').trim(); }
function array(t) { let m = t.match(/^\((.+)\)\[\]$/) || t.match(/^(.+)\[\]$/); return m?.[1]?.trim(); }
function typeExpr(t, v, dir) {
    t = norm(t);
    if (t.endsWith(' | undefined')) {
        let base = t.slice(0, -' | undefined'.length);
        return dir === 'enc' ? `(${v} === undefined ? absent : ${typeExpr(base, v, dir)})` : `(isAbsent(${v}) ? undefined : ${typeExpr(base, v, dir)})`;
    }
    const a = array(t);
    if (a)
        return dir === 'enc' ? `arrayRef(${v}, (x) => ${typeExpr(a, 'x', dir)})` : `decodeArray(${v}, (x) => ${typeExpr(a, 'x', dir)})`;
    if (t.includes(' | ') && !t.startsWith('SourceValue<')) {
        const options = t.split(' | ').map(x => x.trim());
        if (options.every(x => x.endsWith('Node') || ['AstNode', 'ExpressionNode', 'ProblemDataTypeNode', 'RefTargetTypeNode', 'TaskingStartConditionNode', 'DclAttributeNode', 'SpcAttributeNode', 'FormalParameterTypeNode'].includes(x)))
            return dir === 'enc' ? `nodeRef(${v})` : `decodeNodeRef(${v})`;
        throw Error('unknown union ' + t);
    }
    if (t.startsWith('SourceValue<'))
        return dir === 'enc' ? `valueRef(${v})` : `decodeValueRef(${v})`;
    if (t === 'boolean')
        return dir === 'enc' ? `bool(${v})` : `decodeBool(${v})`;
    if (t === 'number' || t === 'AstKind')
        return dir === 'enc' ? `num(${v})` : `decodeNum(${v})`;
    if (t === 'string')
        return dir === 'enc' ? `str(${v})` : `decodeStr(${v})`;
    if (specialNames.includes(t))
        return dir === 'enc' ? `encode${t}(${v})` : `decode${t}(${v})`;
    if (t.endsWith('Node') || ['AstNode', 'ExpressionNode', 'ProblemDataTypeNode', 'RefTargetTypeNode', 'TaskingStartConditionNode', 'DclAttributeNode', 'SpcAttributeNode', 'FormalParameterTypeNode'].includes(t))
        return dir === 'enc' ? `nodeRef(${v})` : `decodeNodeRef(${v})`;
    throw Error('unknown type ' + t);
}
let out = [];
function line(s = '') { out.push(s); }
line('// SPDX-License-Identifier: GPL-3.0-or-later');
line('// Copyright (C) 2026 Jan Bartels');
line('');
line('/* Generated by utility/transport/tools/generateAstGraphTransport.cjs.');
line(' * Explicit AST constructors and fields, no runtime class reflection or prototype patching.');
line(' * Re-run the generator whenever the AST schema changes. */');
line("import { AstKind } from '../../ast/astKind';");
line("import { AstNode } from '../../ast/astNode';");
line("import { SourceValue } from '../../core/sourceValue';");
line("import type { Source } from '../../source/source';");
line("import { SourceValueGraphEncoder, decodeSourceValueGraph, type SourceValueGraphWire } from './sourceValueGraphTransport';");
for (const [type, file] of Object.entries({ ExpressionNode: 'problem/expressions/expressionNode', DclAttributeNode: 'problem/declarations/dclAttributeNode', FormalParameterTypeNode: 'problem/declarations/formalParameterNode', ProblemDataTypeNode: 'problem/types/problemDataTypeNode', RefTargetTypeNode: 'problem/types/refTypeNode', SpcAttributeNode: 'problem/specifications/spcAttributeNode', TaskingStartConditionNode: 'problem/statements/taskingStatementNode', DurationUnit: 'problem/expressions/durationConstantNode' }))
    line(`import type { ${type} } from '../../ast/${file}';`);
for (const c of classes) {
    let rel = path.relative(path.dirname(dest), c.file).replace(/\\/g, '/').replace(/\.ts$/, '');
    if (!rel.startsWith('.'))
        rel = './' + rel;
    line(`import { ${c.name} } from '${rel}';`);
}
for (const s of specialNames) {
    let f = classes.find(c => c.file.endsWith('/' + (s === 'InitElementValue' ? 'initElementNode' : s === 'ConstantFixedFit' || s === 'ConstantFixedFactorOperand' ? 'constantFixedFactorNode' : s === 'ConstantFixedTermTail' ? 'constantFixedTermNode' : s === 'ConstantFixedExpressionTail' ? 'constantFixedExpressionNode' : s === 'DurationConstantComponent' ? 'durationConstantNode' : 'signedConstantExpressionNode') + '.ts'));
    if (!f)
        throw Error('missing ' + s);
    let rel = path.relative(path.dirname(dest), f.file).replace(/\.ts$/, '');
    if (!rel.startsWith('.'))
        rel = './' + rel;
    line(`import type { ${s} } from '${rel}';`);
}
line('');
line('export const AST_GRAPH_TRANSPORT_VERSION = 1 as const;');
line("export type AstFieldWire = string | number | boolean | null | {readonly tag:'missing'} | {readonly tag:'node' | 'value'; readonly id:number} | {readonly tag:'array'; readonly elements:readonly AstFieldWire[]} | {readonly tag:'record'; readonly fields: Readonly<Record<string, AstFieldWire>>};");
line('export interface AstNodeWire {readonly id:number; readonly kind:AstKind; readonly fields:readonly AstFieldWire[]; readonly extras?: Readonly<Record<string, AstFieldWire>>;}');
line('export interface AstGraphWire {readonly version:typeof AST_GRAPH_TRANSPORT_VERSION; readonly rootId:number; readonly nodes:readonly AstNodeWire[]; readonly sourceValues:SourceValueGraphWire;}');
line('export interface DecodedAstGraph {readonly root:AstNode; readonly sourceValues: ReturnType<typeof decodeSourceValueGraph>; resolve(id:number):AstNode;}');
line('const absent: AstFieldWire = {tag:"missing"};');
line('function isAbsent(w:AstFieldWire):boolean {return !!w && typeof w==="object" && "tag" in w && w.tag==="missing";}');
line('function validId(id:number):boolean {return Number.isSafeInteger(id) && id>0;}');
line('function takeRecord(w:AstFieldWire):Readonly<Record<string, AstFieldWire>> { if(!w||typeof w!=="object"||!("tag" in w)||w.tag!=="record"||!w.fields||Array.isArray(w.fields))throw new Error("Malformed AST record field");return w.fields;}');
line('function decodeBool(w:AstFieldWire):boolean {if(typeof w!=="boolean")throw new Error("Invalid AST boolean field");return w;}');
line('function decodeNum(w:AstFieldWire):number {if(typeof w!=="number"||!Number.isFinite(w))throw new Error("Invalid AST number field");return w;}');
line('function decodeStr(w:AstFieldWire):string {if(typeof w!=="string")throw new Error("Invalid AST string field");return w;}');
line('function bool(v:boolean):AstFieldWire{return v;}');
line('function num(v:number):AstFieldWire{if(!Number.isFinite(v))throw new Error("Non-finite AST number");return v;}');
line('function str(v:string):AstFieldWire{return v;}');
line('function arrayRef<T>(items:readonly T[], map:(item:T)=>AstFieldWire):AstFieldWire{return {tag:"array",elements:items.map(map)};}');
line('function decodeArray<T>(w:AstFieldWire,map:(item:AstFieldWire)=>T):readonly T[]{if(!w||typeof w!=="object"||!("tag" in w)||w.tag!=="array"||!Array.isArray(w.elements))throw new Error("Malformed AST array");return w.elements.map(map);}');
// generate complex structures as outer module private to encoder and decoder, using helpers in classes to simplify
line('');
line('export class AstGraphEncoder {');
line('  readonly sourceValues: SourceValueGraphEncoder;');
line('  private readonly ids = new Map<AstNode, number>();');
line('  private readonly records: AstNodeWire[] = [];');
line('  constructor(sourceValues:SourceValueGraphEncoder = new SourceValueGraphEncoder()){this.sourceValues=sourceValues;}');
line('  private valueRef(value:SourceValue<unknown>):AstFieldWire{return {tag:"value",id:this.sourceValues.encode(value)};}');
line('  private nodeRef(node:AstNode):AstFieldWire{return {tag:"node",id:this.encode(node)};}');
for (const [name, fields] of Object.entries(specials)) {
    line(`  private encode${name}(v:${name}):AstFieldWire {const valueRef=this.valueRef.bind(this),nodeRef=this.nodeRef.bind(this);return {tag:"record",fields:{` + Object.entries(fields).map(([k, t]) => `${JSON.stringify(k)}:${typeExpr(t, `v.${k}`, 'enc')}`).join(',') + '}};}');
}
for (const [name, variantsMap] of Object.entries(variants)) {
    line(`  private encode${name}(v:${name}):AstFieldWire {const valueRef=this.valueRef.bind(this),nodeRef=this.nodeRef.bind(this);switch(v.kind){`);
    for (const [k, fields] of Object.entries(variantsMap)) {
        line(`    case ${JSON.stringify(k)}: return {tag:"record",fields:{kind:${JSON.stringify(k)},${Object.entries(fields).map(([k, t]) => `${JSON.stringify(k)}:${typeExpr(t, `v.${k}`, 'enc')}`).join(',')}}};`);
    }
    line('    default: throw new Error("Unknown AST variant");}}');
}
line('  encode(node:AstNode):number { const found=this.ids.get(node);if(found!==undefined)return found;');
line('    const id=this.records.length+1; this.ids.set(node,id);this.records.push(undefined as unknown as AstNodeWire);');
line('    const valueRef=this.valueRef.bind(this),nodeRef=this.nodeRef.bind(this);');
for (const name of specialNames)
    line(`    const encode${name}=this.encode${name}.bind(this);`);
line('    let record:AstNodeWire; switch(node.kind){');
for (const c of classes) {
    let params = c.args.map(p => { let t = p.type + (p.optional ? ' | undefined' : ''); return typeExpr(t, `n.${p.name}`, 'enc'); });
    line(`      case AstKind.${c.kind}: {const n=node as ${c.name}; record={id,kind:node.kind,fields:[${params.join(',')} ]}; break;}`);
}
line('      default:throw new Error(`Unsupported AST node kind ${String(node.kind)}`);');
line('    }');
line('    switch(node.kind){');
line('      case AstKind.TranslationUnit: record={...record,extras:{children:arrayRef((node as TranslationUnitNode).children,nodeRef)}};break;');
line('      case AstKind.SystemPart: record={...record,extras:{children:arrayRef((node as SystemPartNode).children,nodeRef)}};break;');
line('      case AstKind.ProblemPart: record={...record,extras:{children:arrayRef((node as ProblemPartNode).children,nodeRef)}};break;');
line('      case AstKind.Module: {const n=node as ModuleNode;record={...record,extras:{shellCommands:arrayRef(n.shellCommands,nodeRef),systemPart:n.systemPart?nodeRef(n.systemPart):absent,problemPart:n.problemPart?nodeRef(n.problemPart):absent,modendKeyword:n.modendKeyword?valueRef(n.modendKeyword):absent,debugKeyword:n.debugKeyword?valueRef(n.debugKeyword):absent}};break;}');
line('    }');
line('    this.records[id-1]=record;return id; }');
line('  finish(root:AstNode,sources:readonly Source[]=[]):AstGraphWire {const rootId=this.encode(root);return {version:AST_GRAPH_TRANSPORT_VERSION,rootId,nodes:[...this.records],sourceValues:this.sourceValues.finish(sources)};}');
line('}');
line('export function encodeAstGraph(root:AstNode,sources:readonly Source[]=[]):AstGraphWire {return new AstGraphEncoder().finish(root,sources);}');
line('');
line('export function decodeAstGraph(wire:AstGraphWire):DecodedAstGraph {');
line('  if(wire.version!==AST_GRAPH_TRANSPORT_VERSION||!Array.isArray(wire.nodes))throw new Error("Unsupported AST transport version");');
line('  const values=decodeSourceValueGraph(wire.sourceValues);');
line('  const records=new Map<number,AstNodeWire>();');
line('  for(const r of wire.nodes){if(!validId(r.id)||records.has(r.id)||!Array.isArray(r.fields))throw new Error("Invalid or duplicate AST node ID");records.set(r.id,r);}');
line('  const decoded=new Map<number,AstNode>();const visiting=new Set<number>();');
line('  function decodeValueRef(w:AstFieldWire):SourceValue<unknown>{if(!w||typeof w!=="object"||!("tag" in w)||w.tag!=="value"||!validId(w.id))throw new Error("Invalid AST SourceValue reference");return values.resolve(w.id);}');
line('  function decodeNodeRef(w:AstFieldWire):AstNode{if(!w||typeof w!=="object"||!("tag" in w)||w.tag!=="node"||!validId(w.id))throw new Error("Invalid AST node reference");return resolve(w.id);}');
for (const [name, fields] of Object.entries(specials)) {
    line(`  function decode${name}(w:AstFieldWire):${name} {const f=takeRecord(w);return {` + Object.entries(fields).map(([k, t]) => `${k}:${typeExpr(t, `f.${k}`, 'dec')} as ${t}`).join(',') + '};}');
}
for (const [name, variantsMap] of Object.entries(variants)) {
    line(`  function decode${name}(w:AstFieldWire):${name} {const f=takeRecord(w);switch(f.kind){`);
    for (const [k, fields] of Object.entries(variantsMap)) {
        line(`    case ${JSON.stringify(k)}:return {kind:${JSON.stringify(k)},${Object.entries(fields).map(([k, t]) => `${k}:${typeExpr(t, `f.${k}`, 'dec')} as ${t}`).join(',')}};`);
    }
    line('    default:throw new Error("Unknown AST variant");}}');
}
line('  function resolve(id:number):AstNode { if(!validId(id))throw new Error("Invalid AST ID");const existing=decoded.get(id);if(existing)return existing;const record=records.get(id);if(!record)throw new Error(`Missing AST node ID ${id}`);if(visiting.has(id))throw new Error(`Cyclic AST constructor dependency at ${id}`);visiting.add(id);');
line('    try {if(record.fields===undefined)throw new Error("AST fields missing");const f=record.fields;let n:AstNode;switch(record.kind){');
for (const c of classes) {
    let p = c.args.map((a, i) => { let t = a.type + (a.optional ? ' | undefined' : ''); return `(${typeExpr(t, `f[${i}]!`, 'dec')} as ${t})`; });
    line(`      case AstKind.${c.kind}: {if(f.length!==${c.args.length})throw new Error("AST ${c.name} argument count");n=new ${c.name}(${p.join(',')});break;}`);
}
line('      default:throw new Error(`Unsupported AST kind ${String(record.kind)}`);');
line('    }');
line('    const extras=record.extras;switch(record.kind){');
line('      case AstKind.TranslationUnit: {if(!extras)throw new Error("Missing translation-unit children");for(const child of decodeArray(extras.children!,decodeNodeRef))(n as TranslationUnitNode).addChild(child);break;}');
line('      case AstKind.ProblemPart: {if(!extras)throw new Error("Missing problem-part children");for(const child of decodeArray(extras.children!,decodeNodeRef))(n as ProblemPartNode).addChild(child);break;}');
line('      case AstKind.SystemPart: {if(!extras)throw new Error("Missing system-part children");for(const child of decodeArray(extras.children!,decodeNodeRef))(n as SystemPartNode).addChild(child);break;}');
line('      case AstKind.Module: {if(!extras)throw new Error("Missing module fields");const m=n as ModuleNode;for(const child of decodeArray(extras.shellCommands!,decodeNodeRef)){m.shellCommands.push(m.adopt(child as ShellCommandNode));}if(!isAbsent(extras.systemPart!))m.systemPart=m.adopt(decodeNodeRef(extras.systemPart!) as SystemPartNode);if(!isAbsent(extras.problemPart!))m.problemPart=m.adopt(decodeNodeRef(extras.problemPart!) as ProblemPartNode);if(!isAbsent(extras.modendKeyword!))m.modendKeyword=decodeValueRef(extras.modendKeyword!) as SourceValue<string>;if(!isAbsent(extras.debugKeyword!))m.debugKeyword=decodeValueRef(extras.debugKeyword!) as SourceValue<string>;break;}');
line('    }');
line('    decoded.set(id,n);return n;}finally{visiting.delete(id);}}');
line('  const root=resolve(wire.rootId);for(const id of records.keys())resolve(id);return {root,sourceValues:values,resolve};');
line('}');
let generated = out.join('\n').replace(/f\.(\w+)(?![\w!])/g, (match, name) => name === 'kind' ? match : match + '!');
const file = ts.createSourceFile(dest, generated, ts.ScriptTarget.Latest, true);
if (file.parseDiagnostics.length)
    throw new Error('Invalid generated AST TypeScript');
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
fs.writeFileSync(dest, printer.printFile(file));
console.log('wrote ' + dest + ' lines ' + out.length + ' classes ' + classes.length);
