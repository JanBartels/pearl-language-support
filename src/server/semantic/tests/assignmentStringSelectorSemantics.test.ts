// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
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
import { AstLookupResultDocumentationProvider } from '../../documentation/astLookupResultDocumentationProvider';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';

const logger: Logger = { info() {}, warn() {}, error() {} };
const mismatch = SemanticDiagnosticCode.InvalidAssignmentValueType;
const protectedTarget = SemanticDiagnosticCode.AssignmentToInvariant;

function analyze(body: string) {
    const source = new FileSource('file:///assignment-selector.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const assignments: AssignmentNode[] = [];
    function visit(node: AstNode): void {
        if (node.kind === AstKind.Assignment) assignments.push(node as AssignmentNode);
        for (const child of node.getChildren()) visit(child);
    }
    visit(root);
    return {
        source, root, semantic, assignments,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

test('BIT and CHAR single-element selectors are writable assignment objects', () => {
    const r = analyze(`R: PROC;
        DCL B BIT(8), C CHAR(4);
        B.BIT(1) := '1'B;
        C.CHAR(4) := 'X';
        C.CHARACTER(2) = 'Y';
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.assignments.length, 3);
    assert.equal(r.semantic.expressionTypes.get(r.assignments[0].target)?.kind, SemanticTypeKind.Bit);
    assert.equal(r.semantic.expressionTypes.get(r.assignments[1].target)?.kind, SemanticTypeKind.Character);
});

test('string element destinations truncate CHAR values but reject incompatible types', () => {
    const r = analyze(`R: PROC;
        DCL B BIT(8), C CHAR(4);
        B.BIT(2) := '11'B;
        C.CHAR(2) := 'AB';
        B.BIT(3) := 'X';
        C.CHAR(3) := '1'B;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [mismatch, mismatch, mismatch]);
    assert.match(r.errors[0].message, /BIT\(1\).*BIT\(2\)/);
    assert.match(r.errors[1].message, /BIT\(1\).*CHAR\(1\)/);
});

test('INV BIT/CHAR strings protect their selected elements', () => {
    const r = analyze(`R: PROC;
        DCL C INV CHAR(4) INIT('ABCD');
        DCL B INV BIT(4) INIT('1010'B);
        C.CHAR(1) := 'X';
        B.BIT(1) := '1'B;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [protectedTarget, protectedTarget]);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('CHAR(1) := '));
    assert.equal(r.errors[1].location.span.start, r.source.text.indexOf('BIT(1) := '));
});

test('REF INV protects selected characters but INV REF protects only the pointer', () => {
    const r = analyze(`R: PROC;
        DCL C CHAR(4);
        DCL ConstPtr INV REF CHAR(4) INIT(C);
        DCL Readonly REF INV CHAR(4);
        ConstPtr.CHAR(1) := 'A';
        Readonly.CHAR(2) := 'B';
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [protectedTarget]);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('CHAR(2) := '));
});

test('STRUCT components and array elements accept BIT/CHAR destination selection', () => {
    const r = analyze(`TYPE HS STRUCT[C CHAR(4), B BIT(8)];
        R: PROC(I FIXED);
            DCL Records(10) HS;
            Records(I).C.CHAR(2) := 'A';
            Records(I).B.BIT(4) := '1'B;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.assignments.length, 2);
});

test('selected indices on assignment LHS keep existing constant bounds diagnostics', () => {
    const r = analyze(`R: PROC;
        DCL B BIT(8), C CHAR(4);
        B.BIT(0) := '0'B;
        C.CHAR(5) := 'X';
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.ConstantIndexOutOfBounds,
        SemanticDiagnosticCode.ConstantIndexOutOfBounds
    ]);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('0) := '));
    assert.equal(r.errors[1].location.span.start, r.source.text.indexOf('5) := '));
});

test('selector index must be FIXED and must select one position', () => {
    const r = analyze(`R: PROC;
        DCL C CHAR(4);
        C.CHAR('A') := 'B';
        C.CHAR(1,2) := 'B';
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidStringSelectorIndexType,
        SemanticDiagnosticCode.InvalidStringSelectorIndexCount
    ]);
});

test('assignment selector hover exposes its one-character type and AST location', () => {
    const r = analyze(`R: PROC; DCL C CHAR(4); C.CHAR(2) := 'B'; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const offset = r.source.text.indexOf('.CHAR(2)') + 1;
    const lookup = r.root.lookupSourceValue({ uri: r.source.uri, offset });
    assert.ok(lookup);
    const markdown = AstLookupResultDocumentationProvider.getDocumentation(lookup, r.semantic);
    assert.match(markdown ?? '', /String selector/);
    assert.match(markdown ?? '', /CHAR\(1\)/);
});

test('incomplete assignment selector recovers before the next statement', () => {
    const r = analyze(`R: PROC;
        DCL C CHAR(4);
        C.CHAR() := 'X';
        C.CHAR(2) := 'Y';
    END;`);
    assert.equal(r.assignments.length, 2);
    // Empty parentheses are syntactically valid for function calls; only
    // semantic selection reveals that CHAR needs exactly one index.
    assert.deepEqual(r.syntax, []);
    assert.equal(r.assignments[1].target.segments[1]?.identifier.value, 'CHAR');
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidStringSelectorIndexCount
    ]);
});
