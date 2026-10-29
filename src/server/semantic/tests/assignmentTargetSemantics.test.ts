// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

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
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(body: string) {
    const source = new FileSource('file:///assignment-target.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const statements: AssignmentNode[] = [];
    function visit(node: AstNode): void {
        if (node.kind === AstKind.Assignment) statements.push(node as AssignmentNode);
        for (const child of node.getChildren()) visit(child);
    }
    visit(root);
    return {
        source, statements, semantic,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}
const protectedTarget = SemanticDiagnosticCode.AssignmentToInvariant;

test('assignment resolves both sides for hover even when types differ', () => {
    const result = analyze(`R: PROC;
        DCL A FIXED, B FLOAT;
        A := B;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidAssignmentValueType]);
    const statement = result.statements[0];
    assert.ok(statement);
    assert.equal(result.semantic.expressionTypes.get(statement.target)?.kind, SemanticTypeKind.Fixed);
    assert.equal(result.semantic.expressionTypes.get(statement.expression!)?.kind, SemanticTypeKind.Float);
    assert.equal(result.semantic.bindings.get(statement.target.segments[0].identifier)?.kind,
        SymbolKind.DataObject);
    assert.ok(result.semantic.bindings.size > 0);
});

test('INV data object rejects assignment at the target identifier', () => {
    const result = analyze(`R: PROC;
        DCL Constant INV FIXED INIT(7);
        Constant := 42;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [protectedTarget]);
    assert.equal(result.errors[0].location.span.start, result.source.text.indexOf('Constant := 42'));
});

test('mutable array elements and structure components are assignable', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC(I FIXED);
            DCL Records(10) HS;
            DCL V FIXED;
            Records(I).E := V + 1;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.bindings.get(result.statements[0].target.segments[1].identifier)?.kind,
        SymbolKind.StructComponent);
});

test('INV on an entire structure protects its selected component', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        P: PROC(Param INV HS IDENT);
            Param.E := 2;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [protectedTarget]);
    assert.equal(result.errors[0].location.span.start, result.source.text.indexOf('E := 2'));
});

test('INV REF protects the pointer variable but not the referenced target', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        DCL V HS;
        R: PROC;
            DCL P INV REF HS INIT(V);
            P := V;
            P.E := 5;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [protectedTarget]);
    assert.match(result.errors[0].message, /'P'/);
});

test('REF INV allows reassigning the pointer but protects its target', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL P REF INV HS;
            DCL V HS;
            P := V;
            P.E := 5;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [protectedTarget]);
    assert.match(result.errors[0].message, /'E'/);
});

test('INV REF INV protects the pointer and selected target', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        DCL V HS;
        R: PROC;
            DCL P INV REF INV HS INIT(V);
            P := V;
            P.E := 5;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [protectedTarget, protectedTarget]);
});

test('invalid constant indices and unknown identifiers on both sides retain original diagnostics', () => {
    const result = analyze(`R: PROC;
        DCL A(10) FIXED;
        A(11) := Unknown;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.ConstantIndexOutOfBounds,
        SemanticDiagnosticCode.UnknownIdentifier
    ]);
});

test('assignment to an expression function result is not an object', () => {
    const result = analyze(`F: PROC(I FIXED) RETURNS(FIXED); RETURN(I); END;
        R: PROC;
            F(2) := 7;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidAssignmentTarget]);
});
