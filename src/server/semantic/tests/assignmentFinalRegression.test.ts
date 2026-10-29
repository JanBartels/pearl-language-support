// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels
// Regression matrix for Roadmap 8.3: parser, semantic checks, bindings and recovery.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { AstKind } from '../../ast/astKind';
import { AssignmentNode } from '../../ast/problem/statements/assignmentNode';
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
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SymbolKind } from '../symbolKind';

const logger: Logger = { info() {}, warn() {}, error() {} };
const D = SemanticDiagnosticCode;

function analyze(program: string) {
    const source = new FileSource('file:///assignment-final-regression.pearl',
        `MODULE M; PROBLEM;\n${program}\nMODEND;`);
    const problems = new ProblemCollection();
    const preprocessor = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(
        new Lexer(source, problems, logger).tokenize(), source, preprocessor,
        problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast, preprocessor.activeBlockComments);
    const assignments: AssignmentNode[] = [];
    function walk(node: AstNode): void {
        if (node.kind === AstKind.Assignment) assignments.push(node as AssignmentNode);
        for (const child of node.getChildren()) walk(child);
    }
    walk(ast);
    return { source, ast, semantic, assignments,
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error) };
}

function codes(result: ReturnType<typeof analyze>): SemanticDiagnosticCode[] {
    return result.errors.map(error => error.code);
}

test('8.3f: nested STRUCT, array elements, string selectors and RHS calls coexist', () => {
    const r = analyze(`
        TYPE Cell STRUCT[Text CHAR(4), Bits BIT(8), Value FIXED];
        F: PROC(I FIXED) RETURNS(FIXED); RETURN(I + 1); END;
        R: PROC(I FIXED);
            DCL Records(10) Cell;
            DCL Sum FIXED;
            Records(I).Text.CHAR(2) := 'A';
            Records(I).Bits.BIT(4) := '1'B;
            Records(I).Value := F(I) + 3;
            Sum := Records(I).Value;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.assignments.length, 4);
    assert.equal(r.semantic.bindings.get(r.assignments[0].target.segments[1].identifier)?.kind,
        SymbolKind.StructComponent);
    assert.equal(r.semantic.bindings.get(r.assignments[2].target.segments[1].identifier)?.kind,
        SymbolKind.StructComponent);
});

test('8.3f: independent errors are reported at their own assignments without cascades', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        R: PROC;
            DCL A(4) Cell, X INV FIXED INIT(1), C CHAR(2), P REF Cell;
            A(5).E := Unknown;
            X := 1.5;
            C.CHAR(3) := 'X';
            P := 42;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [
        D.ConstantIndexOutOfBounds, D.UnknownIdentifier,
        D.AssignmentToInvariant, D.ConstantIndexOutOfBounds,
        D.InvalidAssignmentValueType
    ]);
    assert.equal(r.assignments.length, 4);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('5).E := '));
    assert.equal(r.errors[3].location.span.start, r.source.text.indexOf('3) := '));
});

test('8.3f: INV REF and REF INV are distinct for pointer and referenced component writes', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        R: PROC;
            DCL V Cell;
            DCL P INV REF Cell INIT(V);
            DCL Q REF INV Cell;
            P := V;
            P.E := 1;
            CONT P := V;
            Q := V;
            Q.E := 2;
            CONT Q := V;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [
        D.AssignmentToInvariant, D.AssignmentToInvariant, D.AssignmentToInvariant
    ]);
    assert.equal(r.assignments.length, 6);
    assert.ok(r.assignments[2].contOperator);
    assert.ok(r.assignments[5].contOperator);
});

test('8.3f: REF reassignment and CONT copy have different expected RHS types', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        R: PROC;
            DCL V Cell, W Other, P REF Cell, Q REF Cell;
            P := V;
            P := Q;
            P := NIL;
            CONT P := V;
            CONT P := Q;
            P := W;
            CONT P := W;
            CONT P := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [
        D.InvalidAssignmentValueType, D.InvalidAssignmentValueType,
        D.InvalidAssignmentValueType
    ]);
    assert.equal(r.assignments.length, 8);
});

test('8.3f: whole-array write is invalid even when the element type is compatible', () => {
    const r = analyze(`
        R: PROC(I FIXED);
            DCL A(10) FIXED, B(10) FIXED;
            A(I) := B(I);
            A := B;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.InvalidArrayAssignment]);
    assert.equal(r.assignments.length, 2);
});

test('8.3f: assignment syntax recovery keeps following statements and no phantom CALL', () => {
    const r = analyze(`
        P: PROC(I FIXED); END;
        R: PROC;
            DCL A(4) FIXED;
            A(1,) := 2;
            P(1);
            A(2) := 3;
        END;`);
    assert.ok(r.syntax.some(m => m.includes('Expected expression')));
    assert.equal(r.assignments.length, 2);
    assert.equal(r.assignments[1].target.segments[0].identifier.value, 'A');
    assert.equal(codes(r).length, 0);
});

test('8.3f: selected target remains bound even if RHS is the wrong type', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        R: PROC;
            DCL V Cell;
            V.E := 'wrong';
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.InvalidAssignmentValueType]);
    const field = r.assignments[0].target.segments[1].identifier;
    assert.equal(r.semantic.bindings.get(field)?.kind, SymbolKind.StructComponent);
    const location = field.location!;
    assert.equal(r.ast.lookupSourceValue({ uri: location.source.uri,
        offset: location.span.start })?.element, field);
});

test('8.3f: CONT on RHS is diagnosed independently of left assignment type', () => {
    const r = analyze(`
        R: PROC;
            DCL V FIXED, P REF FIXED;
            V := CONT P;
            P := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.UnsupportedContExpression]);
    assert.equal(r.assignments.length, 2);
});

test('8.3f: nested REF component follows target type while bare REF component stores address', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Holder STRUCT[Next REF Cell];
        R: PROC;
            DCL H Holder, V Cell;
            H.Next := V;
            CONT H.Next := V;
            H.Next.E := 17;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.assignments.length, 3);
    assert.equal(r.assignments[1].target.segments[1]?.identifier.value, 'Next');
});

test('8.3f: INV REF INV protects pointer and referenced member independently', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        DCL V Cell;
        R: PROC;
            DCL P INV REF INV Cell INIT(V);
            P := V;
            CONT P := V;
            P.E := 9;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.AssignmentToInvariant, D.AssignmentToInvariant,
        D.AssignmentToInvariant]);
});

test('8.3f: REF STRUCT[] preserves target INV protection on assignment', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        R: PROC;
            DCL Writable Cell, Protected INV Cell INIT(2);
            DCL Any REF STRUCT[], ReadOnly REF INV STRUCT[];
            Any := Writable;
            Any := Protected;
            ReadOnly := Writable;
            ReadOnly := Protected;
            Any := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.InvalidAssignmentValueType]);
});

test('8.3f: named types give meaningful mismatch diagnostics for whole STRUCT values', () => {
    const r = analyze(`
        TYPE Cell STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        R: PROC;
            DCL Target Cell, Wrong Other;
            Target := Wrong;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.InvalidAssignmentValueType]);
    assert.match(r.errors[0].message, /Cell/);
    assert.match(r.errors[0].message, /Other/);
});

test('8.3f: time expressions in assignment use the same operator semantics as RETURN', () => {
    const r = analyze(`
        R: PROC;
            DCL T CLOCK, D DURATION;
            T := 12:00:00 + 2 SEC;
            D := T - 11:30:00;
            T := D;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.InvalidAssignmentValueType]);
});

test('8.3f: expression errors in IF and assignment share the same array-bounds rules', () => {
    const r = analyze(`
        R: PROC;
            DCL A(4) FIXED, V FIXED;
            IF A(5) == 0 THEN V := A(5); FIN;
            V := A(2);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(codes(r), [D.ConstantIndexOutOfBounds, D.ConstantIndexOutOfBounds]);
    assert.equal(r.assignments.length, 2);
});
