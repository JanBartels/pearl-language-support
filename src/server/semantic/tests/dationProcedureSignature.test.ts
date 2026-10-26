// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { AstKind } from '../../ast/astKind';
import { CallStatementNode } from '../../ast/problem/statements/callStatementNode';
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
import { SemanticTypeKind } from '../semanticType';
import { formatSemanticType } from '../../documentation/semanticTypeDocumentation';
import { SymbolKind } from '../symbolKind';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(sourceText: string) {
    const source = new FileSource('file:///test.pearl', sourceText);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);

    function findCall(node: AstNode): CallStatementNode | undefined {
        if (node.kind === AstKind.CallStatement) return node as CallStatementNode;
        for (const child of node.getChildren()) {
            const result = findCall(child);
            if (result) return result;
        }
        return undefined;
    }
    const call = findCall(ast);
    assert.ok(call?.target, 'CALL must be preserved in the AST');
    const symbol = semantic.bindings.get(call.target);
    assert.ok(symbol && symbol.kind === SymbolKind.Procedure);
    assert.ok(symbol.signature);
    const hover = call.documentationProvider().getDocumentation(
        call, { node: call, element: call.target }, semantic
    );
    assert.ok(hover);
    return { problems, semantic, symbol, hover };
}

test('RTOS-UH ASSIGN: missing DATION direction is valid and stays unconstrained', () => {
    const parsed = analyze(`MODULE Demo; PROBLEM;
SPC ASSIGN ENTRY(DATION ALPHIC IDENT, CHAR(24)) GLOBAL;
Main: TASK;
    CALL ASSIGN(A1, '/TY');
END;
MODEND;`);
    assert.deepEqual(parsed.problems.toArray().map(issue => issue.message), []);
    assert.ok(parsed.semantic.diagnostics.every(
        diagnostic => diagnostic.code === SemanticDiagnosticCode.MissingScModuleSize
    ), 'no unexpected semantic errors');
    const parameter = parsed.symbol.signature!.parameters[0];
    assert.equal(parameter.type?.kind, SemanticTypeKind.Dation);
    if (parameter.type?.kind === SemanticTypeKind.Dation) {
        assert.equal(parameter.type.direction, undefined);
        assert.equal(parameter.type.dationClass, 'ALPHIC');
    }
    assert.equal(formatSemanticType(parsed.symbol.signature!), 'PROC(DATION ALPHIC IDENT, CHAR(24))');
    assert.ok(parsed.hover.includes('**Signature:** `PROC(DATION ALPHIC IDENT, CHAR(24))`'));
    assert.ok(!parsed.hover.includes('PROC(?'));
});

test('Direction from a preprocessor macro can be omitted without corrupting the hover', () => {
    const parsed = analyze(`#define PEARL90
#ifdef PEARL90
#define INOUTP90_ " "
#else
#define INOUTP90_ "INOUT"
#endif
MODULE Demo; PROBLEM;
SPC ASSIGN ENTRY(DATION INOUTP90_ ALPHIC IDENT, CHAR(24)) GLOBAL;
Main: TASK;
CALL ASSIGN(A1, '/TY');
END;
MODEND;`);
    assert.deepEqual(parsed.problems.toArray().map(issue => issue.message), []);
    assert.ok(parsed.semantic.diagnostics.every(
        diagnostic => diagnostic.code === SemanticDiagnosticCode.MissingScModuleSize
    ), 'no unexpected semantic errors');
    assert.ok(parsed.hover.includes('`PROC(DATION ALPHIC IDENT, CHAR(24))`'));
});

test('An explicit DATION direction is still retained', () => {
    const parsed = analyze(`MODULE Demo; PROBLEM;
SPC SetDevice ENTRY(DATION INOUT ALPHIC IDENT, CHAR(24)) GLOBAL;
Main: TASK;
CALL SetDevice(A1, '/TY');
END;
MODEND;`);
    assert.ok(parsed.semantic.diagnostics.every(
        diagnostic => diagnostic.code === SemanticDiagnosticCode.MissingScModuleSize
    ), 'no unexpected semantic errors');
    assert.ok(parsed.hover.includes('`PROC(DATION INOUT ALPHIC IDENT, CHAR(24))`'));
});
