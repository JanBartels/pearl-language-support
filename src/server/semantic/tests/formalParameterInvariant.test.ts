// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import { SymbolKind } from '../symbolKind';
import { SemanticTypeKind } from '../semanticType';
import { formatSemanticType } from '../../documentation/semanticTypeDocumentation';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const source = new FileSource('file:///formal-parameter-invariant.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    return {
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error),
        semantic
    };
}

test('INV formal IDENT permits INV and writable actuals, unlike writable IDENT formal', () => {
    const result = analyze(`
        P: PROC(X FIXED IDENT); END;
        Q: PROC(X INV FIXED IDENT); END;
        R: PROC RETURNS(FIXED);
            DCL Protected INV FIXED INIT(1);
            DCL Writable FIXED;
            P(Writable);
            P(Protected);
            Q(Writable);
            Q(Protected);
            RETURN(1);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
    assert.match(result.errors[0].message, /INV-geschützt/);
    assert.match(result.errors[0].message, /'X'/);
});

test('INV actual may be transmitted by value, including to INV formals', () => {
    const result = analyze(`
        P: PROC(X FIXED); END;
        Q: PROC(X INV FIXED); END;
        R: PROC;
            DCL Protected INV FIXED INIT(7);
            P(Protected);
            Q(Protected);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('INV protection propagates through structure members and array indexing', () => {
    const result = analyze(`
        P: PROC(X FIXED IDENT); END;
        Q: PROC(X INV FIXED IDENT); END;
        R: PROC;
            DCL S INV STRUCT[E FIXED] INIT(3);
            DCL A(3) INV FIXED INIT(1);
            P(S.E);
            P(A(1));
            Q(S.E);
            Q(A(1));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument,
            SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('INV REF protects pointer itself, REF INV protects its target, including IDENT', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        DCL Value HS;
        DCL Ptr REF HS;
        DCL FrozenPtr INV REF HS INIT(Value);
        DCL ReadOnlyTarget REF INV HS;
        Change: PROC(P REF HS IDENT); END;
        Inspect: PROC(P INV REF HS IDENT); END;
        Target: PROC(P REF INV HS IDENT); END;
        R: PROC;
            Change(Ptr);
            Change(FrozenPtr);
            Inspect(Ptr);
            Inspect(FrozenPtr);
            Target(ReadOnlyTarget);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
    assert.match(result.errors[0].message, /INV-geschützt/);
});

test('SPC ENTRY and REF PROC retain formal INV in their semantic signatures', () => {
    const result = analyze(`
        SPC External ENTRY(A INV FIXED IDENT, INV REF STRUCT[] IDENT) GLOBAL;
        TYPE Handler REF PROC(X INV FIXED IDENT);
        DCL Callback Handler;
        R: PROC; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const values = [...new Set(result.semantic.bindings.values())];
    const external = values.find(s => s.kind === SymbolKind.Procedure && s.name.value === 'External');
    assert.ok(external?.kind === SymbolKind.Procedure && external.signature);
    assert.deepEqual(external.signature.parameters.map(p => p.assignmentProtected), [true, true]);
    assert.match(formatSemanticType(external.signature), /INV FIXED IDENT/);
    assert.match(formatSemanticType(external.signature), /INV REF STRUCT\[\] IDENT/);
    const callback = values.find(s => s.kind === SymbolKind.DataObject && s.name.value === 'Callback');
    assert.ok(callback?.kind === SymbolKind.DataObject);
    // Named REF PROC remains named in the declaration; its definition carries INV.
    const typeSymbol = values.find(s => s.kind === SymbolKind.Type && s.name.value === 'Handler');
    assert.ok(typeSymbol?.kind === SymbolKind.Type);
    const definition = result.semantic.typeDefinitions.get(typeSymbol);
    assert.ok(definition && definition.kind === SemanticTypeKind.Reference);
    assert.equal(definition.target.kind, SemanticTypeKind.Procedure);
    if (definition.target.kind === SemanticTypeKind.Procedure) {
        assert.equal(definition.target.parameters[0].assignmentProtected, true);
    }
});

test('local SPC and PROC signatures detect different formal INV protection', () => {
    const result = analyze(`
        SPC P ENTRY(X INV FIXED IDENT);
        P: PROC(X FIXED IDENT); END;`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.errors.some(d => d.code === SemanticDiagnosticCode.LocalProcedureSpecificationMismatch));
});

test('SPC invocation uses same read-only IDENT protection as a local PROC', () => {
    const result = analyze(`
        SPC P ENTRY(X FIXED IDENT) GLOBAL;
        SPC Q ENTRY(X INV FIXED IDENT) GLOBAL;
        R: PROC;
            DCL Protected INV FIXED INIT(1);
            P(Protected);
            Q(Protected);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('REF INV target protects selected components, but not the pointer variable itself', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL ReadOnly REF INV HS INIT(V);
        DCL Mutable REF HS INIT(V);
        P: PROC(X FIXED IDENT); END;
        Q: PROC(X INV FIXED IDENT); END;
        R: PROC;
            P(Mutable.E);
            P(ReadOnly.E);
            Q(ReadOnly.E);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('REF PROC invocation retains INV IDENT semantics through a TYPE alias', () => {
    const result = analyze(`
        TYPE Callback REF PROC(X INV FIXED IDENT);
        DCL Handler Callback;
        R: PROC;
            DCL Protected INV FIXED INIT(1);
            Handler(Protected);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});
