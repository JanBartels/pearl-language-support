// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
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
import { CallSignatureIndex } from '../callSignatureIndex';
import { createSignatureHelp } from '../../lsp/createSignatureHelp';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import type { CallSignatureInformation } from '../callSignatureInformation';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(
    declarations: string,
    statements = 'P(42);',
    includes: Record<string, string> = {}
) {
    const rootText = `MODULE; PROBLEM;\n${declarations}\nRunner: TASK;\n${statements}\nEND; MODEND;`;
    const source = new FileSource('file:///root.pearl', rootText);
    const registry = {
        resolveInclude: (_parent: string, path: string) =>
            Object.prototype.hasOwnProperty.call(includes, path)
                ? { uri: `file:///${path}`, getText: () => includes[path] }
                : null,
        addInclude: () => {}
    } as unknown as DocumentRegistry;
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const index = new CallSignatureIndex(ast, semantic, context.activeBlockComments);
    const calls: CallStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node.kind === AstKind.CallStatement) calls.push(node as CallStatementNode);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    const signature = (i = 0) => {
        const value = index.get(calls[i])?.[0];
        assert.ok(value && value.kind === 'procedure');
        return value as Extract<CallSignatureInformation, { kind: 'procedure' }>;
    };
    return { signature, info: (i = 0) => index.get(calls[i])?.[0],
        calls, context, problems, semantic, rootText };
}

function names(result: ReturnType<typeof analyze>): Array<[string | undefined, string | undefined]> {
    return result.signature().parameters.map(p => [p.name?.value, p.nameOrigin]);
}

test('manual: SPC ENTRY comments are documentary names including DATION parameters', () => {
    const r = analyze(`SPC P ENTRY(
        /* dation */ DATION ALPHIC IDENT,
        /* name   */ CHAR(128) IDENT,
        /* AI */ BIT(16) IDENT,
        /* TFU */ FIXED(15) IDENT
    ) GLOBAL;`, 'P(1, 2, 3, 4);');
    assert.deepEqual(names(r), [
        ['dation', 'comment'], ['name', 'comment'],
        ['AI', 'comment'], ['TFU', 'comment']
    ]);
    assert.equal(r.signature().parameters[0].byIdentification, true);
});

test('explicit names take precedence over nearby comments and remain explicit', () => {
    const r = analyze('SPC P ENTRY(Real /* Shadow */ FIXED, /* B */ FLOAT);', 'P(1, 2);');
    assert.deepEqual(names(r), [['Real', 'explicit'], ['B', 'comment']]);
});

test('REF PROC via alias chain preserves documentary names and semantic type', () => {
    const r = analyze(`TYPE T REF PROC(/* Number */ FIXED,
        /* Value */ FLOAT IDENT);
        TYPE Alias T;
        DCL R Alias;`, 'R(42, 3);');
    assert.deepEqual(names(r), [['Number', 'comment'], ['Value', 'comment']]);
    assert.equal(r.signature().parameters[1].byIdentification, true);
});

test('direct REF PROC supports comments and no names are invented for absent comments', () => {
    const r = analyze('DCL P REF PROC(/* First */ FIXED, FLOAT, /* Last */ BIT);', 'P(1, 2, 3);');
    assert.deepEqual(names(r), [['First', 'comment'], [undefined, undefined], ['Last', 'comment']]);
});

test('invalid/reserved/multiword comments are not used as parameter names', () => {
    const r = analyze(`SPC P ENTRY(/* FIXED */ FIXED,
        /* multiple words */ FLOAT,
        /*+G*/ BIT,
        /* _hidden */ CLOCK,
        /* foo-bar */ CHAR,
        /* Name: comment */ REF FIXED);`, 'P(1,2,3,4,5,6);');
    assert.deepEqual(names(r), Array.from({length:6}, (): [undefined, undefined] => [undefined, undefined]));
});

test('two consecutive comments block the earlier candidate', () => {
    const r = analyze('SPC P ENTRY(/* A */ /* documentation details */ FIXED);');
    assert.deepEqual(names(r), [[undefined, undefined]]);
});

test('a comment separated from a type by another token does not attach', () => {
    const r = analyze('SPC P ENTRY(/* A */ Named FIXED);');
    assert.deepEqual(names(r), [['Named', 'explicit']]);
});

test('inactive conditional comments never enter the documentation collection', () => {
    const r = analyze(`#ifdef ABSENT
/* Ignored */
#endif
SPC P ENTRY(/* Used */ FIXED);`);
    assert.deepEqual(names(r), [['Used', 'comment']]);
    assert.deepEqual(r.context.activeBlockComments.map(c => c.location.source.getText(c.location.span)),
        ['/* Used */']);
});

test('nested include declarations retain source identity and documentary names', () => {
    const r = analyze(`#include "outer.inc"`, 'P(1, 2);', {
        'outer.inc': '#include "inner.inc"\n',
        'inner.inc': 'SPC P ENTRY(/* FromInclude */ FIXED, /* Next */ FLOAT) GLOBAL;\n'
    });
    assert.deepEqual(names(r), [['FromInclude', 'comment'], ['Next', 'comment']]);
    assert.equal(r.signature().parameters[0].name?.location?.source.uri, 'file:///inner.inc');
    assert.equal(r.context.activeBlockComments.length, 2);
});

test('identical offsets in root and include files never cause name collisions', () => {
    const r = analyze(`/* RootComment */
#include "defs.inc"`, 'P(3);', {
        'defs.inc': 'SPC P ENTRY(/* Included */ FIXED) GLOBAL;'
    });
    assert.deepEqual(names(r), [['Included', 'comment']]);
    assert.equal(r.signature().parameters[0].name?.location?.source.uri, 'file:///defs.inc');
});

test('unnamed local PROC parameters inherit comment names from matching SPC', () => {
    const r = analyze(`SPC P ENTRY(/* FromSpc */ FIXED, /* Second */ FLOAT);
        P: PROC(FIXED, FLOAT); END;`, 'P(1, 2);');
    assert.deepEqual(names(r), [['FromSpc', 'comment'], ['Second', 'comment']]);
});

test('explicit PROC names override documentary SPC names parameter by parameter', () => {
    const r = analyze(`SPC P ENTRY(/* FromSpc */ FIXED, /* Second */ FLOAT);
        P: PROC(Actual FIXED, FLOAT); END;`, 'P(1, 2);');
    assert.deepEqual(names(r), [['Actual', 'explicit'], ['Second', 'comment']]);
});

test('documentary SourceValue points precisely at the identifier inside the comment', () => {
    const r = analyze('SPC P ENTRY(/* Device_Name */ FIXED);');
    const name = r.signature().parameters[0].name;
    assert.ok(name?.location);
    assert.equal(name.location.source.getText(name.location.span), 'Device_Name');
    assert.equal(name.location.source.uri, 'file:///root.pearl');
});

test('a comment before a named type is supported without changing type resolution', () => {
    const r = analyze('TYPE Number FIXED; SPC P ENTRY(/* Counter */ Number);');
    assert.deepEqual(names(r), [['Counter', 'comment']]);
});

test('builtins remain unchanged and do not inherit documentary names', () => {
    const r = analyze('SPC P ENTRY(/* First */ FIXED);', 'WRITE(Thing, 2);');
    assert.equal(r.calls.length, 1);
    assert.equal(r.context.activeBlockComments.length, 1);
    assert.equal(r.info()?.kind, 'builtin');
});

test('LSP signature presentation uses documentary names without additional lookup', () => {
    const r = analyze('SPC P ENTRY(/* first */ FIXED, /* second */ FLOAT);', 'P(1, 2);');
    const help = createSignatureHelp({ call: r.calls[0],
        signatures: [r.signature()], activeParameter: 1 });
    assert.equal(help.signatures.length, 1);
    assert.match(help.signatures[0].label, /first FIXED/);
    assert.match(help.signatures[0].label, /second FLOAT/);
    assert.equal(help.activeParameter, 1);
});
