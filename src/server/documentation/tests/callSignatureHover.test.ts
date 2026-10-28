// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../source/fileSource';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import { CallSignatureIndex } from '../../semantic/callSignatureIndex';
import { CallSignatureHelpIndex } from '../../semantic/callSignatureHelpIndex';
import { createSignatureHelp } from '../../lsp/createSignatureHelp';
import { AstLookupResultDocumentationProvider } from '../astLookupResultDocumentationProvider';

const logger: Logger = { info() {}, warn() {}, error() {} };

function make(sourceBody: string, includes: Record<string, string> = {}) {
    const text = `MODULE; PROBLEM;\n${sourceBody}\nMODEND;`;
    const source = new FileSource('file:///main.pearl', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const registry = {
        resolveInclude: (_parent: string, path: string) =>
            includes[path] === undefined ? null :
                { uri: `file:///${path}`, getText: () => includes[path] },
        addInclude: () => {}
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const index = new CallSignatureIndex(ast, semantic, context.activeBlockComments);
    const hover = (identifier: string, occurrence = 0) => {
        const matches = [...text.matchAll(new RegExp(`\\b${identifier}\\b`, 'g'))];
        const offset = matches[occurrence]?.index;
        assert.notEqual(offset, undefined, `${identifier} occurrence`);
        const result = ast.lookupSourceValue({ uri: source.uri, offset: offset! });
        assert.ok(result, `AST lookup ${identifier}`);
        const markdown = AstLookupResultDocumentationProvider.getDocumentation(result, semantic, index);
        assert.ok(markdown, `Hover ${identifier}`);
        return markdown;
    };
    return { ast, semantic, index, text, source, hover };
}

test('SPC comments appear on the declaration, CALL and implicit call', () => {
    const p = make(`SPC ASSIGN ENTRY(/* Dation */ DATION ALPHIC IDENT,
        /* Devicename */ CHAR(24)) GLOBAL;
        Main: TASK; CALL ASSIGN(A1, '/TY'); ASSIGN(A1, '/TY'); END;`);
    for (let i = 0; i < 3; i++) {
        const hover = p.hover('ASSIGN', i);
        assert.match(hover, /ASSIGN\(Dation DATION ALPHIC IDENT, Devicename CHAR\(24\)\)/);
        assert.equal((hover.match(/\*\*Signature:\*\*/g) ?? []).length, 1);
    }
});

test('unused SPC has documentary names in hover', () => {
    const p = make('SPC Unused ENTRY(/* First */ FIXED, /* Last */ FLOAT);');
    assert.match(p.hover('Unused'), /Unused\(First FIXED, Last FLOAT\)/);
});

test('REF PROC types and alias variables expose same comment names', () => {
    const p = make(`TYPE Signature REF PROC(/* Number */ FIXED, /* Value */ FLOAT IDENT);
        TYPE Alias Signature; DCL R Alias; Main: TASK; R(1, 2); END;`);
    assert.match(p.hover('Signature'), /Number FIXED, Value FLOAT IDENT/);
    assert.match(p.hover('Alias'), /Number FIXED, Value FLOAT IDENT/);
    assert.match(p.hover('R', 0), /Number FIXED, Value FLOAT IDENT/);
    assert.match(p.hover('R', 1), /Number FIXED, Value FLOAT IDENT/);
});

test('local SPC/PROC respects the explicit PROC parameter name', () => {
    const p = make(`SPC P ENTRY(/* Comment */ FIXED, /* Unit */ FLOAT);
        P: PROC(Actual FIXED, FLOAT); END;
        Main: TASK; P(1, 2); END;`);
    assert.match(p.hover('P', 1), /P\(Actual FIXED, Unit FLOAT\)/);
    assert.match(p.hover('P', 2), /P\(Actual FIXED, Unit FLOAT\)/);
});

test('include parameter comments are available in the calling file', () => {
    const p = make('#include "header.inc"\nMain: TASK; P(42); END;', {
        'header.inc': 'SPC P ENTRY(/* FromInclude */ FIXED) GLOBAL;'
    });
    assert.match(p.hover('P'), /P\(FromInclude FIXED\)/);
});

test('Signature Help label is exactly the same as the Hover signature', () => {
    const p = make(`SPC P ENTRY(/* Num */ FIXED, /* Bits */ BIT(8)) RETURNS(FLOAT);
        Main: TASK; CALL P(1, '11111111'B); END;`);
    const index = new CallSignatureHelpIndex(p.ast, p.index);
    const ctx = index.lookup({uri: p.source.uri, offset: p.text.indexOf('P(1') + 2});
    assert.ok(ctx);
    const signature = createSignatureHelp(ctx).signatures[0].label;
    assert.ok(p.hover('P', 1).includes(`\`${signature}\``));
});

test('old Hover output works without passing the new index', () => {
    const p = make('SPC P ENTRY(/* N */ FIXED); Main: TASK; CALL P(2); END;');
    const position = p.text.indexOf('P(2)');
    const lookup = p.ast.lookupSourceValue({uri:p.source.uri,offset:position});
    assert.ok(lookup);
    const documentation = AstLookupResultDocumentationProvider.getDocumentation(lookup, p.semantic);
    assert.match(documentation ?? '', /\*\*Signature:\*\* `PROC\(FIXED\)`/);
});

test('function name in RETURN shows the named formal parameters and result type', () => {
    const p = make(`DCL A(10) FIXED;
        F: PROC(I FIXED, Scale FLOAT) RETURNS(FIXED);
            RETURN(I);
        END;
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(A(I) + F(I, 2.0));
        END;`);
    const functionHover = p.hover('F', 1);
    assert.match(functionHover, /\*\*Signature:\*\* `F\(I FIXED, Scale FLOAT\) RETURNS\(FIXED\)`/);
    assert.equal((functionHover.match(/\*\*Signature:\*\*/g) ?? []).length, 1);
    assert.match(functionHover, /\*\*Expression type:\*\* `FIXED`/);
    const arrayHover = p.hover('A', 1);
    assert.doesNotMatch(arrayHover, /\*\*Signature:\*\*/);
});

test('nested function call has the same named signature as its declaration', () => {
    const p = make(`RetTest: PROC(A FIXED) RETURNS(FIXED);
            DCL F8(10) FIXED;
            RETURN(A + F8(RetTest(7)) + 2*3);
        END;`);
    const expected = /RetTest\(A FIXED\) RETURNS\(FIXED\)/;
    assert.match(p.hover('RetTest', 0), expected);
    assert.match(p.hover('RetTest', 1), expected);
    assert.equal((p.hover('RetTest', 1).match(/\*\*Signature:\*\*/g) ?? []).length, 1);
    assert.doesNotMatch(p.hover('F8', 1), /\*\*Signature:\*\*/);
});

test('CALL procedures and functions in expressions use the same signature formatter', () => {
    const p = make(`P: PROC(I FIXED, Scale FLOAT); END;
        F: PROC(I FIXED, Scale FLOAT) RETURNS(FIXED); RETURN(I); END;
        R: PROC RETURNS(FIXED);
            CALL P(1, 2.0);
            RETURN(F(1, 2.0));
        END;`);
    assert.match(p.hover('P', 1), /\*\*Signature:\*\* `P\(I FIXED, Scale FLOAT\)`/);
    assert.match(p.hover('F', 1), /\*\*Signature:\*\* `F\(I FIXED, Scale FLOAT\) RETURNS\(FIXED\)`/);
});

test('without signature index, expression hover retains its old procedure signature', () => {
    const p = make(`F: PROC(I FIXED) RETURNS(FIXED); RETURN(I); END;
        R: PROC RETURNS(FIXED); RETURN(F(1)); END;`);
    const offset = p.text.indexOf('F(1)');
    const lookup = p.ast.lookupSourceValue({ uri: p.source.uri, offset });
    assert.ok(lookup);
    const doc = AstLookupResultDocumentationProvider.getDocumentation(lookup, p.semantic);
    assert.match(doc ?? '', /\*\*Signature:\*\* `PROC\(FIXED\) RETURNS\(FIXED\)`/);
});

test('function SPC documentary parameter names also appear at expression calls', () => {
    const p = make(`SPC External ENTRY(/* Number */ FIXED, /* Coefficient */ FLOAT) RETURNS(FIXED) GLOBAL;
        R: PROC RETURNS(FIXED); RETURN(External(7, 1.0)); END;`);
    assert.match(p.hover('External', 0), /External\(Number FIXED, Coefficient FLOAT\) RETURNS\(FIXED\)/);
    assert.match(p.hover('External', 1), /External\(Number FIXED, Coefficient FLOAT\) RETURNS\(FIXED\)/);
});

test('function REF PROC aliases preserve documentary argument names in expression hover', () => {
    const p = make(`TYPE FuncType REF PROC(/* Input */ FIXED) RETURNS(FIXED);
        TYPE FuncAlias FuncType;
        DCL F FuncAlias;
        R: PROC(I FIXED) RETURNS(FIXED); RETURN(F(I)); END;`);
    assert.match(p.hover('F', 0), /F\(Input FIXED\) RETURNS\(FIXED\)/);
    assert.match(p.hover('F', 1), /F\(Input FIXED\) RETURNS\(FIXED\)/);
});
