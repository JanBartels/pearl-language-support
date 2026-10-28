// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { NameExpressionNode } from '../../ast/problem/expressions/nameExpressionNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { ProblemCollection } from '../../core/problemCollection';
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
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../symbolOccurrenceIndex';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string) {
    const source = new FileSource('file:///structures.pearl', `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const references = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    const returns: ReturnStatementNode[] = [];
    function walk(node: AstNode): void {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    }
    walk(ast);
    return {
        semantic, references, resolutions, occurrences, returns,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

function expression(result: ReturnType<typeof analyze>, index = 0): NameExpressionNode {
    const found = result.returns[index].expression;
    assert.ok(found instanceof NameExpressionNode);
    return found;
}

test('simple STRUCT component binds to its declaration and carries the component type', () => {
    const result = analyze(`DCL Person STRUCT[Age FIXED];
        R: PROC RETURNS(FIXED); RETURN(Person.Age); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const name = expression(result);
    const component = name.segments[1].identifier;
    assert.equal(result.semantic.bindings.get(name.segments[0].identifier)?.kind, SymbolKind.DataObject);
    assert.equal(result.semantic.bindings.get(component)?.kind, SymbolKind.StructComponent);
    assert.equal(result.semantic.bindings.get(component)?.name.value, 'Age');
    assert.notEqual(result.semantic.bindings.get(component)?.name, component);
    assert.deepEqual(result.semantic.expressionTypes.get(name),
        { kind: SemanticTypeKind.Fixed, precision: undefined });
    const resolution = result.resolutions.lookup(component);
    assert.equal(resolution?.kind, 'bound');
    if (resolution?.kind === 'bound') assert.equal(resolution.declaration,
        result.semantic.bindings.get(component)?.name);
    assert.equal(result.occurrences.lookup(component)?.references.length, 1);
    const declaration = result.semantic.bindings.get(component)!.name;
    assert.equal(result.occurrences.lookup(declaration), result.occurrences.lookup(component));
});

test('nested components do not resolve from the lexical scope', () => {
    const result = analyze(`DCL Zip CHAR(5);
        DCL Person STRUCT[Address STRUCT[Zip FIXED]];
        R: PROC RETURNS(FIXED); RETURN(Person.Address.Zip); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const name = expression(result);
    assert.equal(name.segments.length, 3);
    assert.equal(result.semantic.bindings.get(name.segments[2].identifier)?.kind, SymbolKind.StructComponent);
    assert.deepEqual(result.semantic.expressionTypes.get(name),
        { kind: SemanticTypeKind.Fixed, precision: undefined });
});

test('array-of-structures and structure field arrays accept indices at different positions', () => {
    const result = analyze(`DCL Records(10) STRUCT[Value FIXED];
        DCL Store STRUCT[Numbers(10) FIXED];
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(Records(I).Value);
            RETURN(Store.Numbers(I));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    for (const ret of result.returns) {
        assert.equal(result.semantic.expressionTypes.get(ret.expression!)?.kind, SemanticTypeKind.Fixed);
    }
});

test('recursive TYPE plus REF chain automatically dereferences at each dot', () => {
    const result = analyze(`TYPE Node STRUCT[Value FIXED, Next REF Node];
        DCL Head REF Node;
        R: PROC RETURNS(FIXED); RETURN(Head.Next.Next.Value); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const name = expression(result);
    assert.equal(name.segments.length, 4);
    assert.equal(result.semantic.expressionTypes.get(name)?.kind, SemanticTypeKind.Fixed);
    assert.equal(result.semantic.bindings.get(name.segments[3].identifier)?.kind, SymbolKind.StructComponent);
});

test('component names of different structure declarations retain different identities', () => {
    const result = analyze(`DCL A STRUCT[Value FIXED], B STRUCT[Value FLOAT];
        R: PROC RETURNS(FIXED); RETURN(A.Value); RETURN(B.Value); END;`);
    assert.deepEqual(result.syntax, []);
    const a = expression(result, 0).segments[1].identifier;
    const b = expression(result, 1).segments[1].identifier;
    assert.notEqual(result.semantic.bindings.get(a)?.name, result.semantic.bindings.get(b)?.name);
    assert.equal(result.semantic.expressionTypes.get(result.returns[1].expression!)?.kind,
        SemanticTypeKind.Float);
    // FLOAT is not a valid FIXED return, but the component resolves independently.
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidReturnType]);
});

test('unknown component is diagnosed at the component without cascade', () => {
    const result = analyze(`DCL A STRUCT[Value FIXED];
        R: PROC RETURNS(FIXED); RETURN(A.Missing.More); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.UnknownStructureComponent]);
    assert.equal(result.errors[0].location.source.getText(result.errors[0].location.span), 'Missing');
});

test('selection from scalar is diagnosed at the selected identifier', () => {
    const result = analyze(`DCL X FIXED;
        R: PROC RETURNS(FIXED); RETURN(X.Value); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidStructureSelection]);
    assert.equal(result.errors[0].location.source.getText(result.errors[0].location.span), 'Value');
});

test('invalid nested field index yields only array diagnostic', () => {
    const result = analyze(`DCL A(10) STRUCT[Value FIXED];
        R: PROC RETURNS(FIXED); RETURN(A('x').Value); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidArrayIndexType]);
});

test('BIT and CHAR selectors are deferred rather than mistaken for structure members', () => {
    const result = analyze(`DCL Bits BIT(8), Text CHAR(8);
        R: PROC RETURNS(BIT(1)); RETURN(Bits.BIT(2)); END;
        S: PROC RETURNS(CHAR(1)); RETURN(Text.CHAR(1)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('multiple uses of a field reference all point to one member declaration', () => {
    const result = analyze(`TYPE Pair STRUCT[Left FIXED]; DCL P Pair;
        R: PROC RETURNS(FIXED); RETURN(P.Left+P.Left); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const uses = result.resolutions.all.filter(r => r.reference.identifier.value === 'Left');
    assert.equal(uses.length, 2);
    assert.ok(uses.every(r => r.kind === 'bound'));
    const a = uses[0];
    const b = uses[1];
    if (a.kind === 'bound' && b.kind === 'bound') {
        assert.equal(a.declaration, b.declaration);
        assert.equal(result.occurrences.lookup(a.reference.identifier)?.references.length, 2);
    }
});

test('structure component can be indexed then selected again', () => {
    const result = analyze(`DCL Store STRUCT[Items(10) STRUCT[Count FIXED]];
        R: PROC(I FIXED) RETURNS(FIXED); RETURN(Store.Items(I).Count); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const name = expression(result);
    assert.deepEqual(name.segments.map(segment => segment.identifier.value), ['Store', 'Items', 'Count']);
    assert.equal(result.semantic.expressionTypes.get(name)?.kind, SemanticTypeKind.Fixed);
});

test('a parameterless function returning a structure supports component selection', () => {
    const result = analyze(`TYPE Result STRUCT[Code FIXED];
        DCL Data Result;
        F: PROC RETURNS(Result); RETURN(Data); END;
        R: PROC RETURNS(FIXED); RETURN(F().Code); END;`);
    assert.deepEqual(result.syntax, []);
    // The result's TYPE alias is resolved for the next STRUCT selection.
    const name = expression(result, 1);
    assert.equal(result.semantic.expressionTypes.get(name)?.kind, SemanticTypeKind.Fixed);
    assert.equal(result.semantic.bindings.get(name.segments[1].identifier)?.kind, SymbolKind.StructComponent);
});

test('REF PROC component of a structure supports calls', () => {
    const result = analyze(`TYPE Holder STRUCT[Callback REF PROC(FIXED) RETURNS(FIXED)];
        DCL H Holder;
        R: PROC RETURNS(FIXED); RETURN(H.Callback(3)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.expressionTypes.get(result.returns[0].expression!)?.kind,
        SemanticTypeKind.Fixed);
});
