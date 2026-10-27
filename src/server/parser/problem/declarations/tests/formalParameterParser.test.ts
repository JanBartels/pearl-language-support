// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstNode } from '../../../../ast/astNode';
import { ProcedureDeclarationNode } from '../../../../ast/problem/declarations/procedureDeclarationNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { SemanticAnalyzer } from '../../../../semantic/semanticAnalyzer';
import { SemanticDiagnosticSeverity } from '../../../../semantic/semanticDiagnostic';
import { SemanticTypeKind } from '../../../../semantic/semanticType';
import { SymbolKind } from '../../../../semantic/symbolKind';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parseProcedure(declarations: string) {
    const source = new FileSource('file:///formal-parameter-test.p',
        `MODULE ParameterTest; PROBLEM; ${declarations} MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();

    function findProcedure(node: AstNode): ProcedureDeclarationNode | undefined {
        if (node instanceof ProcedureDeclarationNode) return node;
        for (const child of node.getChildren()) {
            const found = findProcedure(child);
            if (found) return found;
        }
        return undefined;
    }

    const procedure = findProcedure(ast);
    const semantic = new SemanticAnalyzer().analyze(ast);
    return { problems: problems.toArray(), procedure, semantic };
}

test('PROC accepts unnamed FLOAT IDENT parameter with a result type', () => {
    const result = parseProcedure(`FloatProc: PROC( FLOAT IDENT ) RETURNS( BIT );
        RETURN('1'B);
    END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    const proc = result.procedure;
    assert.ok(proc, 'PROC should be preserved in the AST');
    assert.equal(proc.parameters.length, 1);
    assert.equal(proc.parameters[0].identifiers, undefined);
    assert.equal(proc.parameters[0].identKeyword?.value, 'IDENT');
    assert.equal(proc.parameters[0].dumpLabel(), 'FormalParameter(<unnamed>, IDENT)');

    const symbol = result.semantic.bindings.get(proc.name);
    if (!symbol || symbol.kind !== SymbolKind.Procedure) {
        throw new Error('Expected a procedure symbol');
    }
    assert.ok(symbol.signature);
    assert.equal(symbol.signature.parameters.length, 1);
    assert.equal(symbol.signature.parameters[0].type?.kind, SemanticTypeKind.Float);
    assert.equal(symbol.signature.parameters[0].byIdentification, true);
    assert.equal(symbol.signature.resultType?.kind, SemanticTypeKind.Bit);
    assert.deepEqual(result.semantic.diagnostics
        .filter(issue => issue.severity === SemanticDiagnosticSeverity.Error)
        .map(issue => issue.message), []);

    const documentation = proc.documentationProvider().getDocumentation(
        proc, { node: proc, element: proc.name }, result.semantic
    );
    assert.ok(documentation?.includes('1\nformal parameter(s)'));
});

test('Named and unnamed parameters keep correct arity and order in signature', () => {
    const result = parseProcedure(`Combo: PROC( A FIXED, FLOAT IDENT, C CHAR(8) ); END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    const proc = result.procedure;
    assert.ok(proc);
    assert.equal(proc.parameters.length, 3);
    assert.equal(proc.parameters[0].identifiers?.identifiers[0]?.value, 'A');
    assert.equal(proc.parameters[1].identifiers, undefined);
    assert.equal(proc.parameters[2].identifiers?.identifiers[0]?.value, 'C');

    const symbol = result.semantic.bindings.get(proc.name);
    if (!symbol || symbol.kind !== SymbolKind.Procedure) {
        throw new Error('Expected a procedure symbol');
    }
    assert.ok(symbol.signature);
    assert.deepEqual(symbol.signature.parameters.map(parameter => parameter.type?.kind),
        [SemanticTypeKind.Fixed, SemanticTypeKind.Float, SemanticTypeKind.Character]);
    assert.deepEqual(symbol.signature.parameters.map(parameter => parameter.byIdentification),
        [false, true, false]);
});

test('Grouped named parameters still each count as one signature parameter', () => {
    const result = parseProcedure(`Combo: PROC( (A,B) FIXED, FLOAT IDENT ); END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    const proc = result.procedure;
    assert.ok(proc);
    const symbol = result.semantic.bindings.get(proc.name);
    if (!symbol || symbol.kind !== SymbolKind.Procedure) {
        throw new Error('Expected a procedure symbol');
    }
    assert.equal(symbol.signature?.parameters.length, 3);
});

test('Missing parameter type after a name still produces an error', () => {
    const result = parseProcedure(`BadProc: PROC( A ); END;`);
    assert.ok(result.problems.some(issue => issue.message ===
        'Expected formal parameter type.'));
});
