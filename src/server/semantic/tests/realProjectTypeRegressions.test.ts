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
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';
import { canonicalizeSemanticType, RTOS_UH_DEFAULT_TYPE_LENGTHS } from '../semanticTypeComparison';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(code: string) {
    const source = new FileSource('file:///real-project-regressions.pearl',
        `MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const returns: ReturnStatementNode[] = [];
    const walk = (node: AstNode): void => {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    };
    walk(root);
    return {
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error),
        semantic,
        returns
    };
}

test('RTOS-UH default lengths remain canonicalization inputs, not AST rewrites', () => {
    assert.deepEqual(RTOS_UH_DEFAULT_TYPE_LENGTHS,
        { fixed: 15, float: 23, bit: 1, character: 1 });
    assert.deepEqual(canonicalizeSemanticType({ kind: SemanticTypeKind.Fixed, precision: undefined }),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
    assert.deepEqual(canonicalizeSemanticType({ kind: SemanticTypeKind.Float, precision: undefined }),
        { kind: SemanticTypeKind.Float, precision: 23 });
    assert.deepEqual(canonicalizeSemanticType({ kind: SemanticTypeKind.Bit, length: undefined }),
        { kind: SemanticTypeKind.Bit, length: 1 });
    assert.deepEqual(canonicalizeSemanticType({ kind: SemanticTypeKind.Character, length: undefined }),
        { kind: SemanticTypeKind.Character, length: 1 });
});

test('CHAR assignments accept both truncation and blank padding', () => {
    const r = analyze(`R: PROC;
        DCL Small CHAR(3), Large CHAR(8);
        DCL RefLarge REF CHAR(8);
        Small := Large;
        Large := Small;
        Small := 'ABCDEFGHI';
        Small := RefLarge;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('BIT assignment still diagnoses narrowing', () => {
    const r = analyze(`R: PROC;
        DCL Short BIT(2), Long BIT(8);
        Short := Long;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /BIT\(2\).*BIT\(8\)/);
});

test('mixed FLOAT(23) and FIXED(31) arithmetic stays FLOAT(23)', () => {
    const r = analyze(`R: PROC(F FLOAT, Wide FIXED(31)) RETURNS(FLOAT);
        RETURN(F / Wide);
        RETURN(F + Wide);
        RETURN(Wide * F);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    for (const statement of r.returns) {
        assert.ok(statement.expression);
        assert.deepEqual(r.semantic.expressionTypes.get(statement.expression),
            { kind: SemanticTypeKind.Float, precision: 23 });
    }
});

test('explicit FLOAT precision controls mixed arithmetic, while FIXED/FIXED division is unchanged', () => {
    const r = analyze(`R: PROC(F FLOAT(31), Wide FIXED(31)) RETURNS(FLOAT(31));
        RETURN(F / Wide);
        RETURN(Wide / Wide);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    for (const statement of r.returns) {
        assert.ok(statement.expression);
        assert.deepEqual(r.semantic.expressionTypes.get(statement.expression),
            { kind: SemanticTypeKind.Float, precision: 31 });
    }
});

test('FLOAT value parameters accept REF FIXED(31) with implicit dereference', () => {
    const r = analyze(`FloatTest: PROC(F FLOAT); END;
        FloatTest2: PROC;
            DCL RX REF FIXED(31);
            FloatTest(RX);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('FLOAT targets and RETURNS accept FIXED(31) but reject FLOAT-to-FIXED narrowing', () => {
    const r = analyze(`R: PROC(Wide FIXED(31)) RETURNS(FLOAT);
        DCL F FLOAT, P REF FIXED(31);
        F := Wide;
        F := P;
        RETURN(Wide);
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('CHAR value parameters allow truncation and blank-padding for CALL', () => {
    const r = analyze(`Accept: PROC(Text CHAR(3)); END;
        R: PROC;
            DCL Short CHAR(1), Exact CHAR(3), Long CHAR(8);
            DCL P REF CHAR(8);
            Accept(Short);
            Accept(Exact);
            Accept(Long);
            Accept(P);
            Accept('ABCDEFG');
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('CHAR value parameters use the same rule in function expressions', () => {
    const r = analyze(`Get: PROC(Text CHAR(3)) RETURNS(FIXED);
            RETURN(1);
        END;
        R: PROC RETURNS(FIXED);
            DCL Short CHAR(1), Long CHAR(8);
            RETURN(Get(Short) + Get(Long));
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('CHAR IDENT requires exact length, including a dereferenced REF actual', () => {
    const r = analyze(`Accept: PROC(Text CHAR(3) IDENT); END;
        R: PROC;
            DCL Short CHAR(1), Exact CHAR(3), Long CHAR(8);
            DCL P REF CHAR(8), Q REF CHAR(3);
            Accept(Exact);
            Accept(Q);
            Accept(Short);
            Accept(Long);
            Accept(P);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.errors.length, 3);
    assert.ok(r.errors.every(error => /Aktualparameter 1/.test(error.message)));
    assert.match(r.errors[0].message, /CHAR\(3\).*CHAR\(1\)/);
    assert.match(r.errors[1].message, /CHAR\(3\).*CHAR\(8\)/);
    assert.match(r.errors[2].message, /CHAR\(3\).*REF CHAR\(8\)/);
});

test('CHAR IDENT remains exact in function expressions', () => {
    const r = analyze(`Get: PROC(Text CHAR(3) IDENT) RETURNS(FIXED);
            RETURN(1);
        END;
        R: PROC RETURNS(FIXED);
            DCL Exact CHAR(3), Long CHAR(8);
            RETURN(Get(Exact) + Get(Long));
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /CHAR\(3\).*CHAR\(8\)/);
});

test('CHAR value-parameter widening does not relax BIT parameter lengths', () => {
    const r = analyze(`Accept: PROC(B BIT(3)); END;
        R: PROC;
            DCL Small BIT(2), Long BIT(8);
            Accept(Small);
            Accept(Long);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /BIT\(3\).*BIT\(8\)/);
});

test('SPC ENTRY and REF PROC use shared CHAR value-parameter conversion', () => {
    const r = analyze(`SPC External ENTRY(Text CHAR(3)) GLOBAL;
        TYPE Handler REF PROC(Text CHAR(3)) RETURNS(FIXED);
        R: PROC RETURNS(FIXED);
            DCL F Handler;
            DCL Long CHAR(8);
            External(Long);
            RETURN(F(Long));
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('CHAR value transfer to RETURN also uses the common copy semantics', () => {
    const r = analyze(`R: PROC RETURNS(CHAR(3));
            DCL Long CHAR(8);
            RETURN(Long);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});
