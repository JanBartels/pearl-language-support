// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { FormalParameterNode } from '../../ast/problem/declarations/formalParameterNode';
import { AssignmentNode } from '../../ast/problem/statements/assignmentNode';
import { ReferenceArrayTargetNode } from '../../ast/problem/types/referenceArrayTargetNode';
import { ProblemCollection } from '../../core/problemCollection';
import { Severity } from '../../core/severity';
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

function analyze(text: string) {
    const source = new FileSource('file:///Regression24.P', text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast, context.activeBlockComments);
    const lineForOffset = (offset: number): number =>
        text.slice(0, offset).split('\n').length;
    const syntax = problems.toArray().map(problem => ({
        line: lineForOffset(problem.location.span.start),
        severity: problem.severity,
        message: problem.message
    }));
    const diagnostics = semantic.diagnostics.map(diagnostic => ({
        line: lineForOffset(diagnostic.location.span.start),
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message
    }));
    const allNodes: AstNode[] = [];
    function visit(node: AstNode): void {
        allNodes.push(node);
        for (const child of node.getChildren()) visit(child);
    }
    visit(ast);
    return { source, ast, semantic, syntax, diagnostics, allNodes, lineForOffset };
}

// Keep this as the original real-program regression, not a synthesized
// collection of independent fragments: interactions between declarations,
// TYPE aliases and procedural scopes are part of the test.
const realProgram = readFileSync(join(__dirname, 'fixtures', 'Regression24.P'), 'utf8');
const result = analyze(realProgram);
const parserAt = (line: number) => result.syntax.filter(diagnostic => diagnostic.line === line);
const semanticAt = (line: number) => result.diagnostics.filter(diagnostic => diagnostic.line === line);

// The full diagnostic set is checked in addition to the individual cases:
// unexpected cascading errors anywhere in the source must fail this test.
test('Regression24: exact diagnostics of the complete real PEARL program', () => {
    assert.deepEqual(result.syntax.map(p => [p.line, p.severity]), [
        [19, Severity.Warning], [24, Severity.Warning],
        [39, Severity.Error], [40, Severity.Error]
    ]);
    assert.deepEqual(result.diagnostics.map(d => [d.line, d.code, d.severity]), [
        [34, SemanticDiagnosticCode.TimeResolutionLoss, SemanticDiagnosticSeverity.Error],
        [35, SemanticDiagnosticCode.TimeResolutionLoss, SemanticDiagnosticSeverity.Error],
        [65, SemanticDiagnosticCode.MutableReferenceToCharacterLiteral, SemanticDiagnosticSeverity.Warning],
        [79, SemanticDiagnosticCode.InvalidAssignmentValueType, SemanticDiagnosticSeverity.Error],
        [93, SemanticDiagnosticCode.ReferenceTargetProtectionLoss, SemanticDiagnosticSeverity.Warning],
        [95, SemanticDiagnosticCode.ReferenceTargetProtectionLoss, SemanticDiagnosticSeverity.Warning]
    ]);
});

test('Reg1: CASE reads the FIXED value addressed by RX (RTOS-UH 5.6.2.3)', () => {
    assert.deepEqual(semanticAt(13), []);
    assert.deepEqual(semanticAt(14), []);
});

test('Reg2: surplus semicolon before a declaration gives a warning', () => {
    assert.deepEqual(parserAt(19).map(d => d.severity), [Severity.Warning]);
    assert.match(parserAt(19)[0].message, /Semikolon/);
    assert.deepEqual(parserAt(20), []);
});

test('Reg3: BEGIN declaration prefix preserves a subsequent DCL', () => {
    assert.deepEqual(parserAt(24).map(d => d.severity), [Severity.Warning]);
    assert.deepEqual(parserAt(25), []);
});

test('Reg4: REF(,) FLOAT has a genuine rank-two reference-array AST target', () => {
    const arrays = result.allNodes.filter(
        (node): node is ReferenceArrayTargetNode => node instanceof ReferenceArrayTargetNode);
    assert.equal(arrays.length, 1);
    assert.equal(arrays[0].dimensions.rank, 2);
    const symbol = [...result.semantic.bindings].find(([name]) => name.value === 'P'
        && name.location && result.lineForOffset(name.location.span.start) === 30)?.[1];
    assert.ok(symbol && symbol.kind === SymbolKind.DataObject);
    assert.equal(symbol.type.kind, SemanticTypeKind.Reference);
    if (symbol.type.kind === SemanticTypeKind.Reference) {
        assert.equal(symbol.type.target.kind, SemanticTypeKind.VirtualArray);
        if (symbol.type.target.kind === SemanticTypeKind.VirtualArray) {
            assert.equal(symbol.type.target.rank, 2);
            assert.equal(symbol.type.target.elementType.kind, SemanticTypeKind.Float);
        }
    }
    assert.deepEqual(parserAt(30), []);
});

test('Reg5: clock/duration sub-resolution values produce compiler LIMIT errors', () => {
    for (const line of [34, 35]) {
        assert.deepEqual(semanticAt(line).map(d => [d.code, d.severity]), [
            [SemanticDiagnosticCode.TimeResolutionLoss, SemanticDiagnosticSeverity.Error]
        ]);
    }
});

test('Reg6: leading + in FLOAT or DURATION INIT is a syntax error', () => {
    for (const line of [39, 40]) {
        assert.deepEqual(parserAt(line).map(d => d.severity), [Severity.Error]);
        assert.match(parserAt(line)[0].message, /führendes \+/);
    }
});

test('Reg7: LEN accepts a CHARACTER TYPE alias', () => {
    assert.deepEqual(semanticAt(47), []);
});

test('Reg8: TOFIXED CHAR(1) has FIXED(15) precision in UH', () => {
    assert.deepEqual(semanticAt(52), []);
});

test('Reg9: duration ratio and full float expression retain FLOAT(23)', () => {
    const assignment = result.allNodes.filter(node => node instanceof AssignmentNode)
        .find(node => {
            const value = node as AssignmentNode;
            return value.operator.location
                && result.lineForOffset(value.operator.location.span.start) === 59;
        }) as AssignmentNode | undefined;
    assert.ok(assignment?.expression);
    assert.deepEqual(result.semantic.expressionTypes.get(assignment.expression),
        { kind: SemanticTypeKind.Float, precision: 23 });
    assert.deepEqual(semanticAt(59), []);
});

test('Reg10: writable generic REF accepts a literal but warns about mutation', () => {
    assert.deepEqual(semanticAt(65).map(d => [d.code, d.severity]), [
        [SemanticDiagnosticCode.MutableReferenceToCharacterLiteral,
            SemanticDiagnosticSeverity.Warning]
    ]);
});

test('Reg11: concrete formal array bounds are kept in the declaration', () => {
    const parameter = result.allNodes.find(node => node instanceof FormalParameterNode
        && node.identifiers?.identifiers[0]?.value === 'B') as FormalParameterNode | undefined;
    assert.equal(parameter?.dimension?.dumpLabel(), 'DimensionAttribute(1)');
    const symbol = [...result.semantic.bindings].find(([name]) => name.value === 'Reg11P')?.[1];
    assert.ok(symbol && symbol.kind === SymbolKind.Procedure);
    const type = symbol.signature?.parameters[0]?.type;
    assert.equal(type?.kind, SemanticTypeKind.Array);
    if (type?.kind === SemanticTypeKind.Array) {
        assert.deepEqual(type.dimensions, [{ lowerBound: 1n, upperBound: 2000n }]);
        assert.equal(type.elementType.kind, SemanticTypeKind.Fixed);
    }
    assert.deepEqual(parserAt(68), []);
    assert.deepEqual(semanticAt(72), []);
});

test('Reg12: narrowing FIXED assignment fails; widening and FIT pass', () => {
    assert.deepEqual(semanticAt(79).map(d => d.code),
        [SemanticDiagnosticCode.InvalidAssignmentValueType]);
    for (const line of [80, 81, 82]) assert.deepEqual(semanticAt(line), []);
});

test('Reg13: generic REF IDENT allows INV sources with a protection-loss warning', () => {
    for (const line of [92, 94]) assert.deepEqual(semanticAt(line), []);
    for (const line of [93, 95]) {
        assert.deepEqual(semanticAt(line).map(d => [d.code, d.severity]), [
            [SemanticDiagnosticCode.ReferenceTargetProtectionLoss,
                SemanticDiagnosticSeverity.Warning]
        ]);
    }
});

test('Reg6: minus for FLOAT/DURATION and plus for FIXED retain previous syntax', () => {
    const valid = analyze(`P=MPC603; SC=2000; MODULE M; PROBLEM;
        R: PROC;
            DCL F FLOAT INIT(-2.85);
            DCL D DURATION INIT(-2 SEC);
            DCL N FIXED INIT(+2);
        END;
        MODEND;`);
    assert.deepEqual(valid.syntax, []);
    assert.deepEqual(valid.diagnostics.filter(d =>
        d.severity === SemanticDiagnosticSeverity.Error), []);
});

test('Reg6: leading plus in alternative DURATION units is rejected, exponent sign remains valid', () => {
    const invalid = analyze(`P=MPC603; SC=2000; MODULE M; PROBLEM;
        R: PROC;
            DCL D1 DURATION INIT(+1 HRS);
            DCL D2 DURATION INIT(+2 MIN);
            DCL F FLOAT INIT(+0.75);
        END;
        MODEND;`);
    assert.deepEqual(invalid.syntax.map(d => d.severity), [
        Severity.Error, Severity.Error, Severity.Error
    ]);
    const valid = analyze(`P=MPC603; SC=2000; MODULE M; PROBLEM;
        R: PROC;
            DCL F FLOAT INIT(1.25E+2);
            DCL N FIXED INIT(+2);
        END;
        MODEND;`);
    assert.deepEqual(valid.syntax, []);
});
