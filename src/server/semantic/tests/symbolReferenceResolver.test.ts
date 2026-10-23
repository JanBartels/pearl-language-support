// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
import { SourceValue } from '../../core/sourceValue';
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
import { SemanticContext } from '../semanticContext';
import { SymbolKind } from '../symbolKind';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceKind } from '../symbolReference';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import type { SymbolReferenceResolution } from '../symbolReferenceResolution';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';

const quietLogger: Logger = { info() {}, warn() {}, error() {} };

/** Real Lexer -> Preprocessor -> Parser -> 7.1 -> Semantics -> 7.2. */
function analyze(text: string) {
    const source = new FileSource('file:///test.pearl', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, quietLogger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), quietLogger);
    const ast = new Parser(stream, problems, quietLogger).parse();
    const references = new SymbolReferenceCollector().collect(ast);
    const semantic = new SemanticAnalyzer().analyze(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    return { ast, references, semantic, resolutions, problems };
}

function pick(
    resolutions: readonly SymbolReferenceResolution[],
    name: string,
    role?: SymbolReferenceKind
): SymbolReferenceResolution[] {
    return resolutions.filter(result => result.reference.identifier.value === name
        && (role === undefined || result.reference.kind === role));
}

function fakeNode(kind: AstKind, properties: object = {}, children: readonly AstNode[] = []): AstNode {
    return { kind, ...properties, getChildren: () => children } as unknown as AstNode;
}
function name(value: string): SourceValue<string> {
    return new SourceValue(value, {
        source: new FileSource('file:///mock.pearl', value),
        span: { start: 0, end: value.length }
    });
}

test('pipeline: named types resolve to declaration, unknown types remain unresolved', () => {
    const result = analyze(`MODULE; PROBLEM;
        TYPE Node FIXED;
        DCL p REF Node;
        DCL q REF MissingType;
        MODEND;`);
    const found = pick(result.resolutions.all, 'Node', SymbolReferenceKind.Type);
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, 'bound');
    if (found[0].kind === 'bound') {
        assert.equal(found[0].symbol.kind, SymbolKind.Type);
        assert.equal(found[0].declaration.value, 'Node');
        assert.equal(result.resolutions.referencesOf(found[0].declaration).length, 1);
        assert.equal(result.resolutions.lookup(found[0].reference.identifier), found[0]);
    }
    assert.equal(pick(result.resolutions.all, 'MissingType')[0]?.kind, 'unresolved');
    assert.equal(result.resolutions.all.length, result.references.all.length);
});

test('pipeline: forward REF type is allowed, but ordinary forward TYPE is not invented', () => {
    const ref = analyze(`MODULE; PROBLEM; TYPE Link REF Later; TYPE Later FIXED; MODEND;`);
    const later = pick(ref.resolutions.all, 'Later', SymbolReferenceKind.Type);
    assert.equal(later.length, 1);
    assert.equal(later[0].kind, 'bound');

    const ordinary = analyze(`MODULE; PROBLEM; TYPE Alias Later; TYPE Later FIXED; MODEND;`);
    assert.equal(pick(ordinary.resolutions.all, 'Later')[0]?.kind, 'unresolved');
});

test('pipeline: a CALL with an SPC resolves to that specification and a missing CALL stays unresolved', () => {
    const result = analyze(`MODULE; PROBLEM;
        SPC Work PROC GLOBAL;
        Main: PROC;
            CALL Work;
            CALL Missing;
        END;
        MODEND;`);
    const work = pick(result.resolutions.all, 'Work', SymbolReferenceKind.Call);
    assert.equal(work.length, 1);
    assert.equal(work[0].kind, 'bound');
    if (work[0].kind === 'bound') {
        assert.equal(work[0].symbol.kind, SymbolKind.Procedure);
        assert.equal(work[0].declaration.value, 'Work');
    }
    assert.equal(pick(result.resolutions.all, 'Missing', SymbolReferenceKind.Call)[0]?.kind, 'unresolved');
});

test('pipeline: a forward GOTO uses the existing label resolver', () => {
    const result = analyze(`MODULE; PROBLEM;
        Main: PROC;
            GOTO Next;
            Next: ;
            GOTO Absent;
        END;
        MODEND;`);
    const next = pick(result.resolutions.all, 'Next', SymbolReferenceKind.JumpTarget);
    assert.equal(next.length, 1);
    assert.equal(next[0].kind, 'bound');
    if (next[0].kind === 'bound') assert.equal(next[0].symbol.kind, SymbolKind.Label);
    assert.equal(pick(result.resolutions.all, 'Absent')[0]?.kind, 'unresolved');
});

test('does not invent bindings for structural END names', () => {
    const end = name('BlockName');
    const tree = fakeNode(AstKind.TranslationUnit, {}, [
        fakeNode(AstKind.Block, { endIdentifier: end })
    ]);
    const refs = new SymbolReferenceCollector().collect(tree);
    const resolutions = new SymbolReferenceResolver().resolve(refs, new SemanticContext());
    assert.deepEqual(resolutions.all.map(result => result.kind), ['deferred']);
    assert.equal(resolutions.lookup(end)?.kind, 'deferred');
});

test('same names in distinct occurrences cannot collapse, and unbound results preserve existing diagnostics', () => {
    const a = name('Unknown');
    const b = name('Unknown');
    const root = fakeNode(AstKind.TranslationUnit, {}, [
        fakeNode(AstKind.CallStatement, { target: a }),
        fakeNode(AstKind.CallStatement, { target: b })
    ]);
    const references = new SymbolReferenceCollector().collect(root);
    const diagnostic = {
        code: SemanticDiagnosticCode.InvalidCallTarget,
        severity: SemanticDiagnosticSeverity.Error,
        location: a.location!,
        message: 'Invalid call'
    };
    const semantic = new SemanticContext(new Map(), new Map(), [diagnostic]);
    const resolved = new SymbolReferenceResolver().resolve(references, semantic);
    assert.equal(resolved.all.length, 2);
    assert.notEqual(resolved.all[0], resolved.all[1]);
    assert.deepEqual(resolved.lookup(a)?.diagnostics, [diagnostic]);
    // Both mock locations happen to look alike but are different sources.
    assert.deepEqual(resolved.lookup(b)?.diagnostics, []);
});

test('pipeline: nested TYPE declarations shadow module TYPE without conflating their uses', () => {
    const result = analyze(`MODULE; PROBLEM;
        TYPE Level FIXED;
        DCL outer REF Level;
        Main: PROC;
            TYPE Level FLOAT;
            DCL inner REF Level;
        END;
        MODEND;`);
    const occurrences = pick(result.resolutions.all, 'Level', SymbolReferenceKind.Type);
    assert.equal(occurrences.length, 2);
    const [outer, inner] = occurrences;
    assert.equal(outer.kind, 'bound');
    assert.equal(inner.kind, 'bound');
    if (outer.kind === 'bound' && inner.kind === 'bound') {
        assert.notEqual(outer.declaration, inner.declaration);
        assert.equal(result.resolutions.referencesOf(outer.declaration).length, 1);
        assert.equal(result.resolutions.referencesOf(inner.declaration).length, 1);
    }
});

test('pipeline: local SPC/PROC relation leads to the real definition', () => {
    const result = analyze(`MODULE; PROBLEM;
        SPC Work PROC;
        Work: PROC;
        END;
        Main: PROC;
            CALL Work;
        END;
        MODEND;`);
    const calls = pick(result.resolutions.all, 'Work', SymbolReferenceKind.Call);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'bound');
    if (calls[0].kind === 'bound') {
        assert.equal(calls[0].symbol.kind, SymbolKind.Procedure);
        assert.equal(calls[0].declaration.value, 'Work');
        // Target is the actual PROC declaration, not the preceding SPC.
        assert.equal(result.semantic.localSpecificationRelations.get(calls[0].declaration)?.definition,
            calls[0].declaration);
    }
});

test('pipeline: builtin names have a distinct result, and visible symbols take precedence', () => {
    const builtin = analyze(`MODULE; PROBLEM;
        Main: PROC;
            CALL SEEK;
        END;
        MODEND;`);
    assert.equal(pick(builtin.resolutions.all, 'SEEK', SymbolReferenceKind.Call)[0]?.kind, 'builtin');

    const declared = analyze(`MODULE; PROBLEM;
        DCL SEEK FIXED;
        Main: PROC;
            CALL SEEK;
        END;
        MODEND;`);
    const call = pick(declared.resolutions.all, 'SEEK', SymbolReferenceKind.Call)[0];
    assert.equal(call?.kind, 'bound');
    if (call?.kind === 'bound') {
        assert.equal(call.symbol.kind, SymbolKind.DataObject);
        assert.ok(call.diagnostics.some(d => d.code === SemanticDiagnosticCode.InvalidCallTarget));
    }
});

test('pipeline: a macro-expanded identifier binds and retains its own SourceValue identity', () => {
    const result = analyze(`#define NAME "Node"\nMODULE; PROBLEM;
        TYPE Node FIXED;
        DCL p REF NAME;
        MODEND;`);
    const node = pick(result.resolutions.all, 'Node', SymbolReferenceKind.Type)[0];
    assert.equal(node?.kind, 'bound');
    if (node?.kind === 'bound') {
        const compilerLocation = node.reference.identifier.location!;
        const editorLocation = compilerLocation.source.mapLocation(compilerLocation);
        // Current ParserBase.tokenValue() already maps MacroSource positions to
        // editor positions. 7.2 must not attempt a second mapping.
        assert.equal(compilerLocation, editorLocation);
        assert.equal(editorLocation.source.getText(editorLocation.span), 'NAME');
        assert.equal(node.declaration.value, 'Node');
    }
});

test('pipeline: a GLOBAL SPC without local definition binds to its own specification', () => {
    const result = analyze(`MODULE; PROBLEM;
        SPC Remote PROC GLOBAL;
        Main: PROC;
            CALL Remote;
        END;
        MODEND;`);
    const remote = pick(result.resolutions.all, 'Remote', SymbolReferenceKind.Call);
    assert.equal(remote.length, 1);
    assert.equal(remote[0].kind, 'bound');
    if (remote[0].kind === 'bound') {
        assert.equal(remote[0].symbol.kind, SymbolKind.Procedure);
        assert.equal(remote[0].declaration, remote[0].symbol.name);
    }
});
