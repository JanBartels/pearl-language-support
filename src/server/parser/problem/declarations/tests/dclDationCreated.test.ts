// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../../../ast/astKind';
import type { AstNode } from '../../../../ast/astNode';
import { DclDationAttributeNode } from '../../../../ast/problem/declarations/dclDationAttributeNode';
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
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../../../../semantic/semanticDiagnostic';
import { SemanticTypeKind } from '../../../../semantic/semanticType';
import { SymbolKind } from '../../../../semantic/symbolKind';
import { SymbolReferenceCollector } from '../../../../semantic/symbolReferenceCollector';
import { SymbolReferenceKind } from '../../../../semantic/symbolReference';
import { SymbolReferenceResolver } from '../../../../semantic/symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../../../../semantic/symbolOccurrenceIndex';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
const system = `MODULE CreatedDemo;
SYSTEM;
    File: /ED/MyFile.txt.................................;
PROBLEM;
    SPC File DATION INOUT ALPHIC;`;

function analyze(text: string) {
    const source = new FileSource('file:///created-test.p', `${system}\n${text}\nMODEND;`);
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
    const attributes: DclDationAttributeNode[] = [];
    function visit(node: AstNode): void {
        if (node.kind === AstKind.DclDationAttribute) attributes.push(node as DclDationAttributeNode);
        for (const child of node.getChildren()) visit(child);
    }
    visit(ast);
    return { ast, semantic, attributes, problems: problems.toArray(),
        errors: semantic.diagnostics.filter(issue => issue.severity === SemanticDiagnosticSeverity.Error) };
}

test('TASK-local DATION CREATED: example resolves system-dation and declares local symbol', () => {
    const result = analyze(`HuhuTask: TASK PRIO 23;
DCL LocalDation DATION INOUT ALPHIC CREATED(File);
END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    assert.deepEqual(result.errors.map(issue => issue.message), []);
    assert.equal(result.attributes.length, 1);
    const attribute = result.attributes[0];
    assert.equal(attribute.systemDation?.value, 'File');
    assert.equal(attribute.createdKeyword?.value, 'CREATED');
    const sourceSymbol = result.semantic.bindings.get(attribute.systemDation!);
    if (!sourceSymbol || sourceSymbol.kind !== SymbolKind.DataObject) {
        throw new Error('Expected File dation symbol');
    }
    assert.equal(sourceSymbol.type.kind, SemanticTypeKind.Dation);
    const local = [...result.semantic.bindings.values()].find(s => s.name.value === 'LocalDation');
    if (!local || local.kind !== SymbolKind.DataObject) {
        throw new Error('Expected local dation symbol');
    }
    assert.equal(local.type.kind, SemanticTypeKind.Dation);
    if (local.type.kind === SemanticTypeKind.Dation) {
        assert.equal(local.type.direction, 'INOUT');
        assert.equal(local.type.dationClass, 'ALPHIC');
    }

    const refs = new SymbolReferenceCollector().collect(result.ast);
    const creationRefs = refs.all.filter(r => r.kind === SymbolReferenceKind.DationCreationSource);
    assert.equal(creationRefs.length, 1);
    const resolution = new SymbolReferenceResolver().resolve(refs, result.semantic);
    assert.ok(resolution.all.some(r => r.kind === 'bound'
        && r.reference === creationRefs[0]));
    const occurrences = new SymbolOccurrenceIndex(resolution, result.semantic);
    assert.ok(occurrences.lookup(attribute.systemDation!)?.references.includes(attribute.systemDation!));
    assert.equal(occurrences.lookup(attribute.systemDation!)?.declaration,
        sourceSymbol.definition ?? sourceSymbol.name);
    const hover = attribute.documentationProvider().getDocumentation(
        attribute, { node: attribute, element: attribute.systemDation! }, result.semantic
    );
    assert.ok(hover?.includes('Type:')); 
});

test('PROC-local DATION CREATED is legal', () => {
    const result = analyze(`UseFile: PROC;
    DCL LocalDation DATION INOUT ALPHIC CREATED(File);
END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    assert.deepEqual(result.errors.map(issue => issue.message), []);
    assert.equal(result.attributes.length, 1);
});

test('DATION CREATED diagnoses unknown source', () => {
    const result = analyze(`HuhuTask: TASK;
DCL LocalDation DATION INOUT ALPHIC CREATED(Unknown);
END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    assert.deepEqual(result.errors.map(issue => issue.code), [SemanticDiagnosticCode.UnknownIdentifier]);
});

test('DATION CREATED diagnoses non-DATION source', () => {
    const result = analyze(`DCL NotAFile FIXED;
HuhuTask: TASK;
DCL LocalDation DATION INOUT ALPHIC CREATED(NotAFile);
END;`);
    assert.deepEqual(result.problems.map(issue => issue.message), []);
    assert.deepEqual(result.errors.map(issue => issue.code), [SemanticDiagnosticCode.InvalidDationCreationSource]);
});

test('Missing CREATED does not prevent parser recovery', () => {
    const result = analyze(`HuhuTask: TASK;
DCL LocalDation DATION INOUT ALPHIC;
DCL Valid FIXED;
END;`);
    assert.ok(result.problems.some(issue => issue.message === "Expected 'CREATED' in DATION declaration."));
});
