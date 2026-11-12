// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { ProblemTag } from '../../core/problemTag';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import { UnusedSymbolAnalyzer } from '../unusedSymbolAnalyzer';
import { SymbolAccessKind } from '../symbolUsageIndex';
import { SymbolKind } from '../symbolKind';
import { CompilerControlAnalyzer } from '../compilerControlAnalyzer';
import { collectBlockComments } from '../../validation/analysis';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string) {
    const source = new FileSource('file:///unused.pearl',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const references = new SymbolReferenceCollector().collect(ast);
    const semantic = new SemanticAnalyzer().analyze(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const controls = new CompilerControlAnalyzer().analyzeWithEntryPoints(
        ast, collectBlockComments(tokens), semantic
    );
    const result = new UnusedSymbolAnalyzer().analyze(semantic, resolutions, controls.gProcedures);
    return { syntax: problems.toArray().map(p => p.message), semantic, result,
        enriched: semantic.withSymbolUsages(result.usages, result.diagnostics) };
}

function unused(body: string): string[] {
    const result = analyze(body);
    assert.deepEqual(result.syntax, []);
    return result.result.diagnostics
        .filter(d => d.code === SemanticDiagnosticCode.UnusedSymbol).map(d => {
        assert.equal(d.code, SemanticDiagnosticCode.UnusedSymbol);
        assert.equal(d.severity, SemanticDiagnosticSeverity.Warning);
        return d.message.match(/'([^']+)'/)?.[1] ?? '';
    });
}

test('detects unused local and module variables; a write is still a use', () => {
    assert.deepEqual(unused(`
        DCL ModuleUnused FIXED;
        Main: TASK;
            DCL LocalUnused FIXED;
            DCL Written FIXED;
            Written := 5;
        END;`), ['ModuleUnused', 'LocalUnused']);
});

test('GLOBAL data, procedures and tasks are assumed used across modules', () => {
    assert.deepEqual(unused(`
        DCL Shared FIXED GLOBAL;
        Remote: PROC GLOBAL; END;
        RemoteTask: TASK GLOBAL; END;
        DCL Local FIXED;
        LocalProc: PROC; END;
        LocalTask: TASK; END;`), ['Local', 'LocalProc']);
});

test('TASK MAIN is implicitly used without an ACTIVATE reference', () => {
    const result = analyze(`Startup: TASK MAIN; END; Ordinary: TASK; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics.map(d => d.message), []);
    const ordinary = result.enriched.symbolUsages.all.find(u => u.declaration.value === 'Ordinary')!;
    assert.equal(ordinary.externallyVisible, true);
    assert.equal(ordinary.unused, false);
    const startup = result.enriched.symbolUsages.all.find(u => u.declaration.value === 'Startup')!;
    assert.equal(startup.implicitlyUsed, true);
    assert.equal(startup.externallyVisible, true);
    assert.equal(startup.unused, false);
});

test('TASK MAIN remains implicitly used when preceded by a local SPC', () => {
    const result = analyze(`SPC Startup TASK; Startup: TASK MAIN; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics, []);
    const usages = result.result.usages.all.filter(u => u.declaration.value === 'Startup');
    assert.equal(usages.length, 1);
    assert.equal(usages[0].implicitlyUsed, true);
    assert.equal(usages[0].unused, false);
});

test('all TASKs and TASK specifications are potentially used externally', () => {
    const result = analyze(`Ordinary: TASK; END; SPC Remote TASK GLOBAL; SPC Local TASK; Local: TASK; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics, []);
    for (const name of ['Ordinary', 'Remote', 'Local']) {
        const usage = result.result.usages.all.find(u => u.declaration.value === name)!;
        assert.equal(usage.unused, false);
        assert.equal(usage.externallyVisible, true);
    }
});

test('external GLOBAL specifications are never diagnosed as unused', () => {
    assert.deepEqual(unused(`
        SPC External FIXED GLOBAL;
        SPC ExternalProc PROC GLOBAL;
        SPC ExternalTask TASK GLOBAL;
        Main: PROC; END;`), ['Main']);
});

test('a compiler +G procedure is an external entry without PEARL GLOBAL', () => {
    const result = analyze(`
        Entry: PROC /*+G*/; END;
        Unused: PROC; END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics.map(d => d.message),
        ["Symbol 'Unused' wird nicht verwendet."]);
    const entry = result.result.usages.all.find(u => u.declaration.value === 'Entry')!;
    assert.equal(entry.externallyVisible, true);
    assert.equal(entry.unused, false);
    assert.equal(entry.symbol.kind, SymbolKind.Procedure);
    assert.equal('global' in entry.symbol && entry.symbol.global !== undefined, false);
});

test('a +G PROC with a preceding local SPC is still one externally used symbol', () => {
    const result = analyze(`
        SPC Entry PROC;
        Entry: PROC /*+G*/; END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics, []);
    const entries = result.result.usages.all.filter(u => u.declaration.value === 'Entry');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].externallyVisible, true);
    assert.equal(entries[0].unused, false);
});

test('a misplaced +G comment does not mark an unrelated PROC as an external entry', () => {
    assert.deepEqual(unused(`
        /*+G*/
        Local: PROC; END;
    `), ['Local']);
});

test('real references mark types, procedures, task targets and labels as used', () => {
    assert.deepEqual(unused(`
        TYPE Used FIXED;
        TYPE Unused FIXED;
        DCL X Used;
        Helper: PROC; END;
        Worker: TASK; END;
        Main: PROC;
            DCL Local FIXED;
            Local := X;
            CALL Helper;
            ACTIVATE Worker;
            GOTO Done;
            Done: ;
        END;`), ['Unused', 'Main']);
});

test('FORMAT declarations count R(...) references as uses', () => {
    assert.deepEqual(unused(`
        SPC Disk DATION INOUT ALPHIC GLOBAL;
        Startup: TASK MAIN;
            DCL V FIXED;
            InUse: FORMAT (F(4));
            UnusedFormat: FORMAT (F(5));
            PUT V TO Disk BY R(InUse);
        END;`), ['UnusedFormat']);
});

test('local SPC/PROC declaration sites are counted as one definition, not as uses', () => {
    const result = analyze(`SPC Helper PROC; Helper: PROC; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics.map(d => d.message),
        ["Symbol 'Helper' wird nicht verwendet."]);
    assert.equal(result.result.usages.all.filter(u => u.declaration.value === 'Helper').length, 1);
});

test('a referenced local SPC/PROC and shadowed parameters resolve independently', () => {
    assert.deepEqual(unused(`
        SPC Helper PROC;
        Helper: PROC; END;
        Main: PROC(X FIXED, Y FIXED);
            DCL Z FIXED;
            Z := X;
            CALL Helper;
        END;`), ['Main', 'Y']);
});

test('labels without GOTO are unused, FOR controls and STRUCT components are not diagnosed', () => {
    assert.deepEqual(unused(`
        TYPE Item STRUCT[Value FIXED];
        Main: PROC;
            FOR Index FROM 1 TO 5 REPEAT END;
            Unreachable: ;
        END;`), ['Item', 'Main', 'Unreachable']);
});

test('duplicate declarations do not trigger a cascading unused warning at the error site', () => {
    const result = analyze('TYPE A FIXED; TYPE A FLOAT;');
    assert.ok(result.semantic.diagnostics.some(d => d.code === SemanticDiagnosticCode.DuplicateType));
    assert.deepEqual(result.result.diagnostics.map(d => d.location.span.start),
        [result.enriched.symbolUsages.all.find(u => u.symbol.name.value === 'A')!.declaration.location!.span.start]);
});

test('the usage index survives additional diagnostics and distinguishes mapped SourceValues', () => {
    const result = analyze('DCL A FIXED; DCL B FIXED; Main: PROC; A := 1; END;');
    const usages = result.enriched.symbolUsages;
    assert.ok(usages.all.some(u => u.declaration.value === 'A' && !u.unused && u.references.length === 1));
    assert.ok(usages.all.some(u => u.declaration.value === 'B' && u.unused));
    assert.equal(result.enriched.withAdditionalDiagnostics([]).symbolUsages, usages);
    const warning = result.result.diagnostics[0];
    assert.ok(result.enriched.diagnostics.includes(warning));
});

test('Validator publishes unused warnings and the reusable usage index', async () => {
    const { Validator } = await import('../../validation/validator');
    const validator = new Validator(
        {} as ConstructorParameters<typeof Validator>[0],
        { get: () => undefined } as unknown as DocumentRegistry,
        logger
    );
    const text = `P=MPC603; SC=2000; MODULE M; PROBLEM;
        DCL Used FIXED, Unused FIXED, Exported FIXED GLOBAL;
        Entry: PROC /*+G*/; END;
        Ordinary: TASK; END;
        Startup: TASK MAIN;
            Used := 1;
        END;
        MODEND;`;
    const document = {
        uri: 'file:///full-pipeline.P',
        version: 1,
        getText: () => text
    };
    const result = await validator.analyze(
        document as Parameters<InstanceType<typeof Validator>['analyze']>[0],
        { macros: {}, warnOnCharTruncation: true } as Parameters<InstanceType<typeof Validator>['analyze']>[1]
    );
    assert.deepEqual(result.problems.toArray().map(problem => problem.message),
        ["Variable 'Used' wird beschrieben, aber niemals gelesen.",
         "Symbol 'Unused' wird nicht verwendet."]);
    const usages = result.rootAnalysis.semanticContext!.symbolUsages.all;
    assert.equal(usages.find(usage => usage.declaration.value === 'Used')?.unused, false);
    assert.equal(usages.find(usage => usage.declaration.value === 'Unused')?.unused, true);
    assert.equal(usages.find(usage => usage.declaration.value === 'Exported')?.externallyVisible, true);
    assert.equal(usages.find(usage => usage.declaration.value === 'Startup')?.implicitlyUsed, true);
    assert.equal(usages.find(usage => usage.declaration.value === 'Startup')?.externallyVisible, true);
    assert.equal(usages.find(usage => usage.declaration.value === 'Ordinary')?.externallyVisible, true);
    const entry = usages.find(usage => usage.declaration.value === 'Entry')!;
    assert.equal(entry.externallyVisible, true);
    assert.equal(entry.unused, false);
});

function warningNames(body: string, code: SemanticDiagnosticCode): string[] {
    const result = analyze(body);
    assert.deepEqual(result.syntax, []);
    return result.result.diagnostics.filter(d => d.code === code)
        .map(d => d.message.match(/'([^']+)'/)?.[1] ?? '');
}

test('distinguishes a read from a write, including self-increment and array indices', () => {
    const result = analyze(`
        DCL OnlyWritten FIXED, OnlyRead FIXED, Both FIXED, Idx FIXED;
        DCL Values(10) FIXED;
        Startup: TASK MAIN;
            OnlyWritten := 10;
            Both := OnlyRead;
            Both := Both + 1;
            Values(Idx) := Both;
        END;`);
    assert.deepEqual(result.syntax, []);
    const byName = (name: string) => result.result.usages.all.find(u => u.declaration.value === name)!;
    assert.equal(byName('OnlyWritten').written, true);
    assert.equal(byName('OnlyWritten').read, false);
    assert.equal(byName('OnlyRead').read, true);
    assert.equal(byName('OnlyRead').written, false);
    assert.equal(byName('Both').read && byName('Both').written, true);
    assert.equal(byName('Idx').read, true);
    assert.equal(byName('Values').written, true);
    assert.deepEqual(result.result.diagnostics.filter(d =>
        d.code === SemanticDiagnosticCode.WrittenButNeverRead).map(d => d.message), [
            "Variable 'OnlyWritten' wird beschrieben, aber niemals gelesen.",
            "Variable 'Values' wird beschrieben, aber niemals gelesen."
        ]);
    assert.deepEqual(result.result.diagnostics.filter(d =>
        d.code === SemanticDiagnosticCode.ReadButNeverWritten).map(d => d.message), [
            "Variable 'OnlyRead' wird gelesen, aber niemals beschrieben.",
            "Variable 'Idx' wird gelesen, aber niemals beschrieben."
        ]);
    const writeRef = byName('OnlyWritten').references[0].identifier;
    assert.equal(result.result.usages.lookupAccess(writeRef)?.kind, SymbolAccessKind.Write);
    assert.equal(result.result.usages.lookupReference(writeRef), byName('OnlyWritten'));
});

test('INIT values prevent read-but-never-written, but not unused or write-only warnings', () => {
    assert.deepEqual(warningNames(`
        DCL Initialized FIXED INIT(5), UnusedInit FIXED INIT(10), Written FIXED INIT(1);
        Startup: TASK MAIN;
            DCL Receiver FIXED;
            Receiver := Initialized;
            Written := 2;
        END;`, SemanticDiagnosticCode.ReadButNeverWritten), []);
    assert.deepEqual(warningNames(`
        DCL Initialized FIXED INIT(5), UnusedInit FIXED INIT(10), Written FIXED INIT(1);
        Startup: TASK MAIN;
            DCL Receiver FIXED;
            Receiver := Initialized;
            Written := 2;
        END;`, SemanticDiagnosticCode.UnusedSymbol), ['UnusedInit']);
});

test('STRUCT INIT counts as initialization when a named structure component is read', () => {
    const result = analyze(`
        TYPE MyType STRUCT [ E FIXED ];
        DCL Value INV MyType INIT( ( 7 ) );
        MyTask: TASK;
            IF Value.E == 7 THEN
                ;
            FIN;
        END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    assert.deepEqual(result.result.diagnostics, []);
    const value = result.result.usages.all.find(usage => usage.declaration.value === 'Value')!;
    assert.equal(value.initialized, true);
    assert.equal(value.read, true);
    assert.equal(value.unused, false);
    // INIT is meaningful to usage analysis even without a scalar constant value.
    assert.equal('hasInitializationAttribute' in value.symbol
        && value.symbol.hasInitializationAttribute, true);
});

test('STRUCT without INIT remains a read-but-never-written candidate', () => {
    const result = analyze(`
        TYPE MyType STRUCT [ E FIXED ];
        DCL Value MyType;
        MyTask: TASK;
            IF Value.E == 7 THEN ; FIN;
        END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(warningNames(`
        TYPE MyType STRUCT [ E FIXED ];
        DCL Value MyType;
        MyTask: TASK;
            IF Value.E == 7 THEN ; FIN;
        END;
    `, SemanticDiagnosticCode.ReadButNeverWritten), ['Value']);
    assert.equal(result.result.usages.all.find(usage => usage.declaration.value === 'Value')?.initialized, false);
});

test('REF INIT of an invariant STRUCT is an address use, not an apparent unused symbol', () => {
    const result = analyze(`
        TYPE MyType STRUCT [ E FIXED ];
        DCL Value INV MyType INIT( ( 7 ) );
        DCL RIX REF INV MyType INIT(Value);
        MyTask: TASK;
            IF RIX.E == 7 THEN ; FIN;
        END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    assert.deepEqual(result.result.diagnostics, []);
    const value = result.result.usages.all.find(usage => usage.declaration.value === 'Value')!;
    const pointer = result.result.usages.all.find(usage => usage.declaration.value === 'RIX')!;
    assert.equal(value.initialized, true);
    assert.equal(value.addressTaken, true);
    assert.equal(value.unused, false);
    assert.equal(pointer.initialized, true);
    assert.equal(pointer.read, true);
    assert.equal(pointer.unused, false);
});

test('GLOBAL and implicit TASK MAIN are exempt from access-mode warnings', () => {
    const result = analyze(`
        DCL External FIXED GLOBAL, Local FIXED;
        Startup: TASK MAIN;
            Local := External;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.result.diagnostics.map(d => d.code),
        [SemanticDiagnosticCode.WrittenButNeverRead]);
    assert.equal(result.result.usages.all.find(u => u.declaration.value === 'Startup')?.accesses[0]?.kind,
        SymbolAccessKind.Implicit);
});

test('GET/PUT, READ/WRITE, TAKE/SEND and CONVERT classify data direction', () => {
    const result = analyze(`
        SPC Text DATION INOUT ALPHIC GLOBAL;
        SPC Binary DATION INOUT BASIC GLOBAL;
        SPC Port DATION INOUT BASIC GLOBAL;
        Startup: TASK MAIN;
            DCL FromGet FIXED, ToPut FIXED;
            DCL FromRead FIXED, ToWrite FIXED;
            DCL FromTake FIXED, ToSend FIXED;
            DCL FromConvert FIXED, ToConvert FIXED;
            DCL Buffer CHAR(30);
            GET FromGet FROM Text BY F(5);
            PUT ToPut TO Text BY F(5);
            READ FromRead FROM Binary;
            WRITE ToWrite TO Binary;
            TAKE FromTake FROM Port;
            SEND ToSend TO Port;
            CONVERT FromConvert FROM Buffer BY F(5);
            CONVERT ToConvert TO Buffer BY F(5);
        END;`);
    assert.deepEqual(result.syntax, []);
    const kind = (name: string) => result.result.usages.all.find(u => u.declaration.value === name)!.accesses[0]?.kind;
    for (const name of ['FromGet', 'FromRead', 'FromTake', 'FromConvert']) {
        assert.equal(kind(name), SymbolAccessKind.Write, name);
    }
    for (const name of ['ToPut', 'ToWrite', 'ToSend', 'ToConvert']) {
        assert.equal(kind(name), SymbolAccessKind.Read, name);
    }
});

test('IDENT actuals are address uses; do not infer read/write effects of the callee', () => {
    const result = analyze(`
        Writer: PROC(X FIXED IDENT); X := 1; END;
        Startup: TASK MAIN;
            DCL Passed FIXED, NotPassed FIXED;
            CALL Writer(Passed);
            NotPassed := 1;
        END;`);
    assert.deepEqual(result.syntax, []);
    const passed = result.result.usages.all.find(u => u.declaration.value === 'Passed')!;
    assert.equal(passed.addressTaken, true);
    assert.equal(passed.read || passed.written, false);
    assert.equal(passed.accesses[0].kind, SymbolAccessKind.Address);
    assert.ok(!result.result.diagnostics.some(d => d.message.includes("'Passed'")));
    assert.ok(result.result.diagnostics.some(d => d.code === SemanticDiagnosticCode.WrittenButNeverRead
        && d.message.includes("'NotPassed'")));
});

test('REF INIT references record address escapes and suppress access-mode warnings', () => {
    const result = analyze(`
        DCL Value FIXED;
        DCL Pointer REF FIXED INIT(Value);
        Startup: TASK MAIN;
            Value := 3;
            PUT Pointer TO Log;
        END;`);
    const value = result.result.usages.all.find(u => u.declaration.value === 'Value')!;
    assert.equal(value.addressTaken, true);
    assert.equal(value.accesses[0].kind, SymbolAccessKind.Address);
    assert.ok(!result.result.diagnostics.some(d =>
        d.code === SemanticDiagnosticCode.WrittenButNeverRead && d.message.includes("'Value'")));
});

test('REF INV FIXED INIT of an invariant constant is an address use', () => {
    const result = analyze(`
        DCL IX INV FIXED INIT(7);
        DCL RIX REF INV FIXED INIT(IX);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    const ix = result.result.usages.all.find(u => u.declaration.value === 'IX')!;
    const rix = result.result.usages.all.find(u => u.declaration.value === 'RIX')!;
    assert.equal(ix.unused, false);
    assert.equal(ix.addressTaken, true);
    assert.equal(ix.accesses[0].kind, SymbolAccessKind.Address);
    assert.equal(rix.unused, true);
    assert.deepEqual(result.result.diagnostics.map(d => d.message),
        ["Symbol 'RIX' wird nicht verwendet."]);
});

test('a normal function-like PROC use is a bound symbol reference', () => {
    const result = analyze(`
        Calc: PROC(X FLOAT) RETURNS(FLOAT); RETURN(X); END;
        Runner: TASK MAIN;
            DCL Result FLOAT;
            Result := Calc(7.0);
        END;
    `);
    assert.deepEqual(result.syntax, []);
    const proc = result.result.usages.all.find(u => u.declaration.value === 'Calc')!;
    assert.equal(proc.unused, false);
    assert.equal(proc.references.length, 1);
});

test('REF value actuals take addresses; REF variables passed by value are read', () => {
    const result = analyze(`
        Accept: PROC(P REF FIXED); END;
        Startup: TASK MAIN;
            DCL Target FIXED, Ptr REF FIXED INIT(Target);
            CALL Accept(Target);
            CALL Accept(Ptr);
        END;`);
    assert.deepEqual(result.syntax, []);
    const target = result.result.usages.all.find(u => u.declaration.value === 'Target')!;
    const ptr = result.result.usages.all.find(u => u.declaration.value === 'Ptr')!;
    assert.equal(target.addressTaken, true);
    assert.equal(target.read, false);
    assert.equal(ptr.read, true);
    assert.equal(ptr.initialized, true);
    assert.ok(!result.result.diagnostics.some(d => d.message.includes("'Target'")));
    assert.ok(!result.result.diagnostics.some(d => d.message.includes("'Ptr'")));
});

test('RST output is a write, while ordinary format arguments are reads', () => {
    const result = analyze(`
        SPC Disk DATION INOUT ALPHIC GLOBAL;
        Startup: TASK MAIN;
            DCL Status FIXED, Width FIXED, Value FIXED;
            GET Value FROM Disk BY RST(Status), F(Width);
        END;`);
    assert.deepEqual(result.syntax, []);
    const kind = (name: string) => result.result.usages.all
        .find(u => u.declaration.value === name)!.accesses[0]?.kind;
    assert.equal(kind('Status'), SymbolAccessKind.Write);
    assert.equal(kind('Width'), SymbolAccessKind.Read);
    assert.equal(kind('Value'), SymbolAccessKind.Write);
});

test('repeated writes remain a single symbol-level warning without flow analysis', () => {
    const result = analyze(`
        Startup: TASK MAIN;
            DCL X FIXED;
            X := 1;
            X := 2;
            IF X > 0 THEN X := 3; FIN;
        END;`);
    assert.deepEqual(result.syntax, []);
    const usage = result.result.usages.all.find(u => u.declaration.value === 'X')!;
    assert.equal(usage.read, true);
    assert.equal(usage.written, true);
    assert.ok(!result.result.diagnostics.some(d => d.message.includes("'X'")));
});

test('user procedure named ABS is used when called in an expression', () => {
    const result = analyze(`ABS: PROC(X FLOAT) RETURNS(FLOAT); RETURN(X); END;
        Runner: TASK MAIN; DCL Result FLOAT; Result := ABS(7.0); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics.filter(d =>
        d.severity === SemanticDiagnosticSeverity.Error), []);
    assert.equal(result.result.usages.all.find(usage => usage.declaration.value === 'ABS')?.unused, false);
    assert.deepEqual(result.result.diagnostics.filter(d =>
        d.code === SemanticDiagnosticCode.UnusedSymbol), []);
});

test('ABS procedure occurrence in IF is a use even when the call has a type error', () => {
    const result = analyze(`ABS: PROC(X FLOAT) RETURNS(FLOAT); RETURN(X); END;
        Runner: TASK MAIN; IF ABS(7) > 0.0 THEN ; FIN; END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.result.usages.all.find(usage => usage.declaration.value === 'ABS')?.unused, false);
    assert.equal(result.result.diagnostics.some(d => d.code === SemanticDiagnosticCode.UnusedSymbol
        && /'ABS'/.test(d.message)), false);
});


test('only genuinely unnecessary declarations and write-only variables are tagged', () => {
    const result = analyze(`
        DCL Unused FIXED, Written FIXED, Read FIXED;
        Main: TASK MAIN;
            Written := Read;
        END;
    `);
    const byCode = (code: SemanticDiagnosticCode) => result.result.diagnostics
        .filter(d => d.code === code);
    for (const d of [...byCode(SemanticDiagnosticCode.UnusedSymbol),
                     ...byCode(SemanticDiagnosticCode.WrittenButNeverRead)]) {
        assert.deepEqual(d.tags, [ProblemTag.Unnecessary]);
    }
    for (const d of byCode(SemanticDiagnosticCode.ReadButNeverWritten)) {
        assert.equal(d.tags, undefined);
    }
});

test('Validator emits tagged unused warnings and inactive-region hints', async () => {
    const { Validator } = await import('../../validation/validator');
    const validator = new Validator(
        {} as ConstructorParameters<typeof Validator>[0],
        { get: () => undefined } as unknown as DocumentRegistry,
        logger
    );
    const text = `P=MPC603; SC=2000; MODULE M; PROBLEM;
DCL Unused FIXED;
#ifdef DISABLED
DCL Hidden FIXED;
#else
DCL Written FIXED;
#endif
Startup: TASK MAIN; Written := 7; END;
MODEND;`;
    const result = await validator.analyze(
        { uri: 'file:///inactive-usage.P', version: 1, getText: () => text } as Parameters<InstanceType<typeof Validator>['analyze']>[0],
        { macros: {}, warnOnCharTruncation: true } as Parameters<InstanceType<typeof Validator>['analyze']>[1]
    );
    const all = result.problems.toArray();
    const inactive = all.filter(d => d.message.startsWith('Inaktiver Code'));
    assert.equal(inactive.length, 1);
    assert.deepEqual(inactive[0]!.tags, [ProblemTag.Unnecessary]);
    assert.equal(text.slice(inactive[0]!.location.span.start, inactive[0]!.location.span.end),
        'DCL Hidden FIXED;\n');
    assert.equal(all.some(d => d.message.includes("'Hidden'")), false);
    const unused = all.find(d => d.message.includes("'Unused'"));
    const written = all.find(d => d.message.includes("'Written'"));
    assert.deepEqual(unused?.tags, [ProblemTag.Unnecessary]);
    assert.deepEqual(written?.tags, [ProblemTag.Unnecessary]);
});

test('STRUCT REF component INIT binds its target and records an address use', () => {
    const result = analyze(`
        TYPE MyType STRUCT [ E FIXED ];
        TYPE MyType2 STRUCT [ E FIXED, R REF INV MyType ];
        DCL Value INV MyType INIT( ( 7 ) );
        DCL Value2 INV MyType INIT( ( 7 ) );
        DCL Value3 INV MyType2 INIT( 1, Value2 );
        MyTask: TASK;
            IF Value.E == 7 THEN ; FIN;
            IF Value3.R ISNT NIL THEN ; FIN;
        END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    assert.deepEqual(result.result.diagnostics, []);
    const value2 = result.result.usages.all.find(u => u.declaration.value === 'Value2')!;
    assert.equal(value2.unused, false);
    assert.equal(value2.addressTaken, true);
    assert.equal(value2.references.length, 1);
    assert.equal(value2.accesses[0].kind, SymbolAccessKind.Address);
    assert.equal(result.result.usages.all.find(u => u.declaration.value === 'Value3')?.initialized, true);
});

test('STRUCT REF component INIT binds the referenced declaration, not an unrelated symbol', () => {
    const result = analyze(`
        TYPE Cell STRUCT [ V FIXED ];
        TYPE WithPtr STRUCT [ Number FIXED, Pointer REF INV Cell ];
        DCL Referenced INV Cell INIT((1));
        DCL Other INV Cell INIT((2));
        DCL Box INV WithPtr INIT(3, Referenced);
        T: TASK;
            IF Box.Pointer ISNT NIL THEN ; FIN;
        END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    const referenced = result.result.usages.all.find(u => u.declaration.value === 'Referenced')!;
    const other = result.result.usages.all.find(u => u.declaration.value === 'Other')!;
    assert.equal(referenced.addressTaken, true);
    assert.equal(referenced.unused, false);
    assert.equal(other.unused, true);
});

test('nested STRUCT INIT resolves REF leaves through named structure components', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Inner STRUCT[Number FIXED, Pointer REF INV Cell];
        TYPE Outer STRUCT[Tag FIXED, Nested Inner];
        DCL Target INV Cell INIT(7);
        DCL Container INV Outer INIT(1, 2, Target);
        Worker: TASK;
            IF Container.Nested.Pointer ISNT NIL THEN ; FIN;
        END;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    const target = result.result.usages.all.find(u => u.declaration.value === 'Target')!;
    assert.equal(target.addressTaken, true);
    assert.equal(target.unused, false);
    assert.equal(target.references.length, 1);
    assert.equal(result.semantic.referenceInitializerIdentifiers.size, 1);
    assert.equal(result.result.usages.lookupAccess(target.references[0].identifier)?.kind, SymbolAccessKind.Address);
});

test('STRUCT INIT resolves named FIXED constants and nested REF targets independently', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Inside STRUCT[Value FIXED, Pointer REF INV Cell];
        TYPE Box STRUCT[InsideData Inside];
        DCL Named INV FIXED INIT(4);
        DCL Target INV Cell INIT(3);
        DCL Container Box INIT(Named, Target);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    const named = result.result.usages.all.find(u => u.declaration.value === 'Named')!;
    const target = result.result.usages.all.find(u => u.declaration.value === 'Target')!;
    assert.equal(named.read, true);
    assert.equal(named.addressTaken, false);
    assert.equal(target.addressTaken, true);
    assert.equal(target.read, false);
});

test('STRUCT INIT visits REF fields inside an array component', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Box STRUCT[Items(2) REF INV Cell, Last REF INV Cell];
        DCL First INV Cell INIT(1);
        DCL Second INV Cell INIT(2);
        DCL LastOne INV Cell INIT(3);
        DCL Container INV Box INIT(First, Second, LastOne);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    for (const name of ['First', 'Second', 'LastOne']) {
        const usage = result.result.usages.all.find(u => u.declaration.value === name)!;
        assert.equal(usage.addressTaken, true, name);
        assert.equal(usage.unused, false, name);
        assert.equal(usage.references.length, 1, name);
    }
});

test('ARRAY of STRUCT INIT resolves repeated nested REF leaves', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Inner STRUCT[Pointer REF INV Cell];
        TYPE Outer STRUCT[Number FIXED, Nested Inner];
        DCL First INV Cell INIT(1);
        DCL Second INV Cell INIT(2);
        DCL Boxes(2) INV Outer INIT(10, First, 11, Second);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    for (const name of ['First', 'Second']) {
        const usage = result.result.usages.all.find(u => u.declaration.value === name)!;
        assert.equal(usage.addressTaken, true, name);
        assert.equal(usage.unused, false, name);
    }
});

test('multiple STRUCT identifiers receive separate INIT element ranges', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Box STRUCT[Number FIXED, Pointer REF INV Cell];
        DCL First INV Cell INIT(1);
        DCL Second INV Cell INIT(2);
        DCL (Box1, Box2) INV Box INIT(11, First, 12, Second);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    for (const name of ['First', 'Second']) {
        const usage = result.result.usages.all.find(u => u.declaration.value === name)!;
        assert.equal(usage.addressTaken, true, name);
        assert.equal(usage.references.length, 1, name);
    }
});

test('invalid nested REF initializer is bound for navigation but not marked as address-taken', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Box STRUCT[Nested STRUCT[P REF INV Cell]];
        DCL Wrong FIXED;
        DCL Container Box INIT(Wrong);
    `);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.semantic.diagnostics.some(d => d.message.includes('REF')));
    const wrong = result.result.usages.all.find(u => u.declaration.value === 'Wrong')!;
    assert.equal(wrong.addressTaken, false);
    assert.equal(result.semantic.referenceInitializerIdentifiers.size, 0);
});

test('named ARRAY types nested inside STRUCT resolve without expanding large arrays', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Slot STRUCT[R REF INV Cell];
        TYPE Slots(2) Slot;
        TYPE Outer STRUCT[Items Slots, Last REF INV Cell];
        DCL First INV Cell INIT(1);
        DCL Second INV Cell INIT(2);
        DCL Third INV Cell INIT(3);
        DCL Container Outer INIT(First, Second, Third);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    assert.equal(result.semantic.referenceInitializerIdentifiers.size, 3);
    for (const name of ['First', 'Second', 'Third']) {
        const usage = result.result.usages.all.find(u => u.declaration.value === name)!;
        assert.equal(usage.addressTaken, true, name);
    }
    assert.equal(result.semantic.withAdditionalDiagnostics([]).referenceInitializerIdentifiers.size, 3);
    assert.equal(result.enriched.referenceInitializerIdentifiers.size, 3);
});

test('ARRAY of STRUCT with an initialization prefix still binds explicit REF names', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Outer STRUCT[N FIXED, R REF INV Cell];
        DCL First INV Cell INIT(1);
        DCL Many(1000000) Outer INIT(3, First);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    const first = result.result.usages.all.find(u => u.declaration.value === 'First')!;
    assert.equal(first.addressTaken, true);
    assert.equal(first.references.length, 1);
});

test('an incomplete mixed STRUCT/ARRAY INIT never invents a REF binding', () => {
    const result = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Box STRUCT[Items(2) FIXED, Pointer REF INV Cell];
        DCL Target INV Cell INIT(3);
        DCL Container Box INIT(1, Target);
    `);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.semantic.referenceInitializerIdentifiers.size, 0);
    const target = result.result.usages.all.find(u => u.declaration.value === 'Target')!;
    assert.equal(target.addressTaken, false);
});
