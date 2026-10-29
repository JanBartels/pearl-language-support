// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
import { AssignmentNode } from '../../ast/problem/statements/assignmentNode';
import type { AstNode } from '../../ast/astNode';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const source = new FileSource('file:///assignment-ref.pearl', `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast, context.activeBlockComments);
    const assignments: AssignmentNode[] = [];
    function visit(node: AstNode): void {
        if (node instanceof AssignmentNode) assignments.push(node);
        for (const child of node.getChildren()) visit(child);
    }
    visit(ast);
    return {
        source, ast, assignments,
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}
const mismatch = SemanticDiagnosticCode.InvalidAssignmentValueType;
const invariant = SemanticDiagnosticCode.AssignmentToInvariant;

test('REF assignment accepts object address, compatible REF value and NIL', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL V HS, W HS, P REF HS, Q REF HS;
            P := V;
            P := Q;
            P := NIL;
            P := (NIL);
            P.E := 7;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.assignments.length, 5);
});

test('REF assignment rejects nonaddressable and mismatched targets', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED]; TYPE Other STRUCT[E FLOAT];
        R: PROC;
            DCL P REF HS, V Other, ROther REF Other;
            P := V;
            P := ROther;
            P := 42;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [mismatch, mismatch, mismatch]);
});

test('REF INV target protection is directional for address assignment', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL Protected INV HS INIT(1), V HS;
            DCL Mutable REF HS, ReadOnly REF INV HS;
            Mutable := Protected;
            Mutable := ReadOnly;
            ReadOnly := Protected;
            ReadOnly := V;
            ReadOnly := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [mismatch, mismatch]);
});

test('INV REF protects pointer assignment, CONT writes through it', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED]; DCL V HS;
        R: PROC;
            DCL P INV REF HS INIT(V);
            P := V;
            CONT P := V;
            CONT P = V;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [invariant]);
    assert.equal(r.assignments[1].contOperator?.value, 'CONT');
    assert.equal(r.assignments[2].contOperator?.value, 'CONT');
    const cont = r.assignments[1].contOperator!;
    const loc = cont.location!;
    assert.equal(r.ast.lookupSourceValue({ uri: loc.source.uri, offset: loc.span.start })?.element, cont);
});

test('REF INV forbids CONT through protected target even with mutable pointer', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL P REF INV HS, V HS;
            P := V;
            CONT P := V;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [invariant]);
});

test('CONT requires REF target; scalar target is a diagnostic', () => {
    const r = analyze(`R: PROC; DCL V FIXED; CONT V := 3; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidContAssignmentTarget]);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('CONT V'));
});

test('CONT copies dereferenced value, checks type, and rejects NIL', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL P REF HS, Q REF HS, V HS, Other FLOAT;
            CONT P := Q;
            CONT P := V;
            CONT P := Other;
            CONT P := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [mismatch, mismatch]);
});

test('NIL is invalid for non-REF assignment, including parentheses', () => {
    const r = analyze(`R: PROC; DCL V FIXED; V := NIL; V := (NIL); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [mismatch, mismatch]);
});

test('CONT preserves label and next statement after bad RHS', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED]; R: PROC;
        DCL P REF HS, V HS;
        Again: CONT P := ;
        P := V;
        END;`);
    assert.ok(r.syntax.some(message => message.includes('Expected expression')));
    assert.equal(r.assignments.length, 2);
    assert.ok(r.assignments[0].contOperator);
    assert.equal(r.assignments[1].contOperator, undefined);
});

test('CONT on the right is not an implemented RTOS-UH expression operator', () => {
    const r = analyze(`R: PROC; DCL P REF FIXED, V FIXED;
        V := CONT P;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.UnsupportedContExpression]);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('CONT P'));
});

test('CONT on a reference component is resolved through the structure type', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED]; TYPE Holder STRUCT[Next REF HS];
        R: PROC;
            DCL H Holder, V HS;
            CONT H.Next := V;
            H.Next := V;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.assignments[0].target.segments.length, 2);
});

test('untyped REF STRUCT[] destinations preserve REF INV target protection', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL V HS, Protected INV HS INIT(1);
            DCL Any REF STRUCT[], AnyReadOnly REF INV STRUCT[];
            Any := V;
            Any := Protected;
            AnyReadOnly := V;
            AnyReadOnly := Protected;
            Any := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [mismatch]);
});

test('reference assignment accepts a function returning compatible REF', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED]; DCL V HS;
        F: PROC RETURNS(REF HS); RETURN(V); END;
        R: PROC;
            DCL P REF HS;
            P := F;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});
