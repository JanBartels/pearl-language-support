// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
import {
    SourceHighlightAttribute as Attribute,
    SourceHighlightKind as Kind,
    type SourceHighlight
} from '../sourceHighlight';
import { SymbolHighlightCollector } from '../symbolHighlightCollector';
import { SymbolOccurrenceIndex } from '../symbolOccurrenceIndex';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string): { text: string; highlights: readonly SourceHighlight[]; errors: readonly string[] } {
    const text = `P=MPC603; SC=2000; MODULE Test; PROBLEM;\n${body}\nMODEND;`;
    const source = new FileSource('file:///tokens.pearl', text);
    const problems = new ProblemCollection();
    const preprocessor = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, preprocessor, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const references = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    const highlights = new SymbolHighlightCollector().collect(semantic, occurrences);
    return { text, highlights, errors: problems.toArray().map(problem => problem.message) };
}

function at(result: ReturnType<typeof analyze>, word: string, occurrence = 0): SourceHighlight {
    const matches = [...result.text.matchAll(new RegExp(`\\b${word}\\b`, 'g'))];
    const offset = matches[occurrence]?.index;
    assert.notEqual(offset, undefined, `Missing ${occurrence}th '${word}'`);
    const match = result.highlights.find(highlight =>
        highlight.element.value === word && highlight.element.location?.span.start === offset);
    assert.ok(match, `Missing highlight '${word}' at ${offset}`);
    return match;
}

function classified(highlight: SourceHighlight, kind: Kind, attributes: readonly Attribute[]): void {
    assert.equal(highlight.kind, kind);
    assert.deepEqual(highlight.attributes ?? [], attributes);
}

test('classifies named types, readonly objects and structure components at declaration and use', () => {
    const result = analyze(`
        TYPE MyType STRUCT [ E FIXED ];
        DCL Value INV MyType INIT((7));
        Main: TASK;
            IF Value.E == 7 THEN ; FIN;
        END;`);
    assert.deepEqual(result.errors, []);
    classified(at(result, 'MyType', 0), Kind.Type, [Attribute.Declaration]);
    classified(at(result, 'MyType', 1), Kind.Type, []);
    classified(at(result, 'Value', 0), Kind.DataObject, [Attribute.Declaration, Attribute.Readonly]);
    classified(at(result, 'Value', 1), Kind.DataObject, [Attribute.Readonly]);
    classified(at(result, 'E', 0), Kind.StructComponent, [Attribute.Declaration]);
    classified(at(result, 'E', 1), Kind.StructComponent, []);
    classified(at(result, 'Main', 0), Kind.Task, [Attribute.Declaration]);
});

test('classifies procedure, formal parameter and return-value reference', () => {
    const result = analyze(`
        Helper: PROC(X INV FIXED) RETURNS(FIXED);
            RETURN(X);
        END;
        Main: TASK;
            DCL Y FIXED;
            Y := Helper(7);
        END;`);
    assert.deepEqual(result.errors, []);
    classified(at(result, 'Helper', 0), Kind.Procedure, [Attribute.Declaration]);
    classified(at(result, 'Helper', 1), Kind.Procedure, []);
    classified(at(result, 'X', 0), Kind.Parameter, [Attribute.Declaration, Attribute.Readonly]);
    classified(at(result, 'X', 1), Kind.Parameter, [Attribute.Readonly]);
    classified(at(result, 'Y', 0), Kind.DataObject, [Attribute.Declaration]);
    classified(at(result, 'Y', 1), Kind.DataObject, []);
});

test('SPC and corresponding PROC are both declarations of one function', () => {
    const result = analyze(`
        SPC Helper PROC;
        Helper: PROC; END;
        Main: TASK; CALL Helper; END;`);
    assert.deepEqual(result.errors, []);
    classified(at(result, 'Helper', 0), Kind.Procedure, [Attribute.Declaration]);
    classified(at(result, 'Helper', 1), Kind.Procedure, [Attribute.Declaration]);
    classified(at(result, 'Helper', 2), Kind.Procedure, []);
});

test('label declarations and GOTO targets are classified', () => {
    const result = analyze(`
        Main: TASK;
            GOTO Done;
            Done: ;
        END;`);
    assert.deepEqual(result.errors, []);
    classified(at(result, 'Done', 0), Kind.Label, []);
    classified(at(result, 'Done', 1), Kind.Label, [Attribute.Declaration]);
});

test('unresolved named types are not classified as valid symbols', () => {
    const result = analyze(`DCL R REF UnknownType;`);
    assert.deepEqual(result.highlights.filter(highlight => highlight.element.value === 'UnknownType'), []);
});

test('classifications preserve distinct lexical occurrences even when names are shadowed', () => {
    const result = analyze(`
        TYPE Level FIXED;
        DCL Outer REF Level;
        Main: PROC;
            TYPE Level FLOAT;
            DCL Inner REF Level;
        END;`);
    assert.deepEqual(result.errors, []);
    classified(at(result, 'Level', 0), Kind.Type, [Attribute.Declaration]);
    classified(at(result, 'Level', 1), Kind.Type, []);
    classified(at(result, 'Level', 2), Kind.Type, [Attribute.Declaration]);
    classified(at(result, 'Level', 3), Kind.Type, []);
});
