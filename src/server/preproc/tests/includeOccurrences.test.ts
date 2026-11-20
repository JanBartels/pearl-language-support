// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Parser } from '../../parser/parser';
import { ArrayTokenStream } from '../../lexer/arrayTokenStream';
import { AstDumper } from '../../ast/astDumper';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import { AstLookupResultDocumentationProvider } from '../../documentation/astLookupResultDocumentationProvider';
import type { ExpandedSource } from '../../source/expandedSource';
import { mapToOriginalLocation } from '../../core/sourceOffset';
import { Lexer } from '../../lexer/lexer';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { ConditionalStack } from '../conditionalStack';
import { MacroTable } from '../macroTable';
import { Preprocessor } from '../preprocessor';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorContext } from '../preprocessorContext';
import type { IncludeOccurrence } from '../includeOccurrence';
import { PreprocessorInactiveRegionCollector, type InactiveSourceRegion } from '../preprocessorInactiveRegionCollector';

const rootUri = 'file:///tests/main.P';
const sharedUri = 'file:///tests/Shared.h';
const outerUri = 'file:///tests/Outer.h';
const innerUri = 'file:///tests/Inner.h';
const quiet: Logger = { info() {}, warn() {}, error() {} };

function preprocess(rootText: string, included: ReadonlyMap<string, string>): {
    text: string;
    expandedSource: ExpandedSource;
    occurrences: readonly IncludeOccurrence[];
    dependencies: readonly string[];
    problemCount: number;
    inactiveRegions: readonly InactiveSourceRegion[];
    conditionalStates: readonly boolean[];
} {
    const sources = new Map<string, string>([[rootUri, rootText], ...included]);
    const registry = {
        resolveInclude: (including: string, name: string) => {
            const uri = new URL(name, including).href;
            const text = sources.get(uri);
            return text === undefined ? null : { uri, getText: () => text };
        }
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const source = new FileSource(rootUri, rootText);
    const problems = new ProblemCollection();
    const blocks = new PreprocessorConditionalBlockCollection();
    const expanded = Preprocessor.createExpanded(
        new Lexer(source, problems, quiet).tokenize(), source, context,
        problems, [], blocks, quiet
    );
    return {
        text: expanded.source.text,
        expandedSource: expanded.source,
        occurrences: context.includeOccurrences,
        dependencies: [...context.includedSourceUris],
        problemCount: problems.size(),
        inactiveRegions: new PreprocessorInactiveRegionCollector().collectWithOrigins(blocks),
        conditionalStates: [...blocks].map(block => block.conditionSatisfied)
    };
}

test('repeated include in one unit retains distinct expansions and site identities', () => {
    const root = `MODULE M; PROBLEM;
#define DEKLARATIONEN
#include "Shared.h"
#undef DEKLARATIONEN
#include "Shared.h"
MODEND;`;
    const shared = `#ifdef DEKLARATIONEN
TYPE Declared FIXED;
#else
TYPE Specified FLOAT;
#endif`;
    const result = preprocess(root, new Map([[sharedUri, shared]]));

    assert.equal(result.problemCount, 0);
    assert.deepEqual(result.dependencies, [sharedUri]);
    const occurrences = result.occurrences.filter(occ => occ.sourceUri === sharedUri);
    assert.equal(occurrences.length, 2);
    assert.notEqual(occurrences[0]!.id, occurrences[1]!.id);
    assert.equal(occurrences[0]!.sites.length, 1);
    assert.equal(occurrences[1]!.sites.length, 1);
    assert.equal(occurrences[0]!.sites[0]!.includingUri, rootUri);
    assert.equal(occurrences[0]!.sites[0]!.directiveOffset, root.indexOf('#include'));
    assert.equal(occurrences[1]!.sites[0]!.directiveOffset, root.lastIndexOf('#include'));
    assert.equal(occurrences[0]!.expandedSpan.end <= occurrences[1]!.expandedSpan.start, true);
    const emitted = occurrences.map(occ => result.text.slice(occ.expandedSpan.start, occ.expandedSpan.end));
    assert.match(emitted[0]!, /TYPE Declared FIXED/);
    assert.doesNotMatch(emitted[0]!, /TYPE Specified FLOAT/);
    assert.match(emitted[1]!, /TYPE Specified FLOAT/);
    assert.doesNotMatch(emitted[1]!, /TYPE Declared FIXED/);
});

test('nested include sites distinguish the same inner directive executed twice', () => {
    const root = `MODULE M; PROBLEM;
#include "Outer.h"
#include "Outer.h"
MODEND;`;
    const result = preprocess(root, new Map([
        [outerUri, '#include "Inner.h"\n'],
        [innerUri, 'TYPE InnerType FIXED;\n']
    ]));
    assert.equal(result.problemCount, 0);
    assert.deepEqual(new Set(result.dependencies), new Set([outerUri, innerUri]));
    const outer = result.occurrences.filter(occ => occ.sourceUri === outerUri);
    const inner = result.occurrences.filter(occ => occ.sourceUri === innerUri);
    assert.equal(outer.length, 2);
    assert.equal(inner.length, 2);
    assert.notEqual(inner[0]!.id, inner[1]!.id);
    assert.equal(inner[0]!.sites.length, 2);
    assert.deepEqual(inner[0]!.sites[1], inner[1]!.sites[1]);
    assert.notDeepEqual(inner[0]!.sites[0], inner[1]!.sites[0]);
    for (const occurrence of inner) {
        const parent = outer.find(o => o.id === JSON.stringify(
            occurrence.sites.slice(0, 1).map(site => [site.includingUri, site.directiveOffset, site.includedUri])
        ));
        assert.ok(parent);
        assert.ok(parent.expandedSpan.start <= occurrence.expandedSpan.start);
        assert.ok(parent.expandedSpan.end >= occurrence.expandedSpan.end);
    }
});

test('occurrence IDs remain stable when expanded text grows', () => {
    const root = `MODULE M; PROBLEM;
#include "Shared.h"
MODEND;`;
    const a = preprocess(root, new Map([[sharedUri, 'TYPE A FIXED;']]));
    const b = preprocess(root, new Map([[sharedUri, 'TYPE A FIXED; TYPE B FIXED;']]));
    assert.equal(a.occurrences.length, 1);
    assert.equal(b.occurrences.length, 1);
    assert.equal(a.occurrences[0]!.id, b.occurrences[0]!.id);
    assert.notDeepEqual(a.occurrences[0]!.expandedSpan, b.occurrences[0]!.expandedSpan);
});

test('inactive include directives do not create occurrences', () => {
    const root = `MODULE M; PROBLEM;
#ifdef UNKNOWN
#include "Shared.h"
#endif
MODEND;`;
    const result = preprocess(root, new Map([[sharedUri, 'TYPE A FIXED;']]));
    assert.equal(result.problemCount, 0);
    assert.deepEqual(result.dependencies, []);
    assert.deepEqual(result.occurrences, []);
});

test('one physical identifier maps to separate expanded positions in repeated includes', () => {
    const root = `MODULE M; PROBLEM;
#define DECL "DCL"
#include "Shared.h"
#undef DECL
#define DECL "SPC"
#include "Shared.h"
MODEND;`;
    const header = 'DECL SharedValue FIXED GLOBAL;';
    const source = new FileSource(rootUri, root);
    const files = new Map([[sharedUri, header]]);
    const registry = {
        resolveInclude: (including: string, name: string) => {
            const uri = new URL(name, including).href;
            const text = files.get(uri);
            return text === undefined ? null : { uri, getText: () => text };
        }
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const problems = new ProblemCollection();
    const expanded = Preprocessor.createExpanded(
        new Lexer(source, problems, quiet).tokenize(), source, context,
        problems, [], new PreprocessorConditionalBlockCollection(), quiet
    );
    const occurrences = context.includeOccurrences;
    assert.equal(occurrences.length, 2);
    const tokens = new Lexer(expanded.source, problems, quiet).tokenize();
    const nameTokens = tokens.filter(token =>
        token.location.source.getText(token.location.span) === 'SharedValue');
    assert.equal(nameTokens.length, 2);
    const originals = nameTokens.map(token => mapToOriginalLocation(token.location));
    assert.ok(originals.every(original => original.source.uri === sharedUri));
    assert.deepEqual(originals[0]!.span, originals[1]!.span);
    assert.notDeepEqual(nameTokens[0]!.location.span, nameTokens[1]!.location.span);
    for (let i = 0; i < 2; i++) {
        const occ = occurrences[i]!;
        const token = nameTokens[i]!;
        assert.ok(occ.expandedSpan.start <= token.location.span.start);
        assert.ok(occ.expandedSpan.end >= token.location.span.end);
    }
    assert.equal(problems.size(), 0);
});


test('one parser and semantic analysis retain both local declarations from repeated includes', () => {
    const root = `P=MPC603;
SC=2000;
MODULE M; PROBLEM;
First: PROC;
#define MYTYPE "FIXED"
#include "Shared.h"
Var := 3;
END;
Second: PROC;
#undef MYTYPE
#define MYTYPE "FLOAT"
#include "Shared.h"
Var := 3.5;
END;
MODEND;`;
    const result = preprocess(root, new Map([[sharedUri, 'DCL Var MYTYPE;']]));
    assert.equal(result.occurrences.length, 2);
    assert.equal(result.problemCount, 0);
    const problems = new ProblemCollection();
    const tokens = new Lexer(result.expandedSource, problems, quiet).tokenize();
    const ast = new Parser(
        new ArrayTokenStream(tokens, result.expandedSource), problems, quiet
    ).parse();
    assert.equal(problems.size(), 0);
    const tree = AstDumper.dump(ast);
    assert.match(tree, /ProcedureDeclaration\(First[^]*?SimpleType\(FIXED\)/);
    assert.match(tree, /ProcedureDeclaration\(Second[^]*?SimpleType\(FLOAT\)/);
    assert.equal(new SemanticAnalyzer().analyze(ast, []).diagnostics.length, 0);
});

test('AST lookup honours an explicitly selected include expansion span', () => {
    const root = `P=MPC603;
SC=2000;
MODULE M; PROBLEM;
First: PROC;
#define MYTYPE "FIXED"
#include "Shared.h"
END;
Second: PROC;
#undef MYTYPE
#define MYTYPE "FLOAT"
#include "Shared.h"
END;
MODEND;`;
    const header = 'DCL Var MYTYPE;';
    const expanded = preprocess(root, new Map([[sharedUri, header]]));
    const occurrences = expanded.occurrences.filter(o => o.sourceUri === sharedUri);
    assert.equal(occurrences.length, 2);
    const problems = new ProblemCollection();
    const tokens = new Lexer(expanded.expandedSource, problems, quiet).tokenize();
    const ast = new Parser(new ArrayTokenStream(tokens, expanded.expandedSource), problems, quiet).parse();
    assert.equal(problems.size(), 0);
    const cursor = header.indexOf('Var');
    const first = ast.lookupSourceValue({uri: sharedUri, offset: cursor,
        occurrenceSpan: occurrences[0]!.expandedSpan});
    const second = ast.lookupSourceValue({uri: sharedUri, offset: cursor,
        occurrenceSpan: occurrences[1]!.expandedSpan});
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.element.value, 'Var');
    assert.equal(second.element.value, 'Var');
    assert.notEqual(first.element, second.element);
    assert.ok(first.element.lexicalLocation);
    assert.ok(second.element.lexicalLocation);
    assert.ok(first.element.lexicalLocation!.span.start < second.element.lexicalLocation!.span.start);
    const semantics = new SemanticAnalyzer().analyze(ast);
    const firstHover = AstLookupResultDocumentationProvider.getDocumentation(first, semantics);
    const secondHover = AstLookupResultDocumentationProvider.getDocumentation(second, semantics);
    assert.match(firstHover ?? '', /FIXED/);
    assert.match(secondHover ?? '', /FLOAT/);
    assert.equal(ast.lookupSourceValue({uri: sharedUri, offset: cursor,
        occurrenceSpan: {start: 999999, end: 1000000}}), undefined);
});


test('include guard inactivity is scoped to the later execution of the same header', () => {
    const root = `MODULE M; PROBLEM;
#include "Shared.h"
#include "Shared.h"
MODEND;`;
    const shared = `#ifndef _shared_h_
#define _shared_h_
TYPE GuardedType FIXED;
#endif
`;
    const result = preprocess(root, new Map([[sharedUri, shared]]));
    assert.equal(result.problemCount, 0);
    assert.equal(result.occurrences.length, 2);
    const [first, second] = result.occurrences;
    assert.deepEqual(result.conditionalStates, [true, false]);
    assert.equal(result.inactiveRegions.length, 1);
    const disabled = result.inactiveRegions[0]!;
    assert.equal(disabled.includeOccurrenceId, second!.id);
    assert.notEqual(disabled.includeOccurrenceId, first!.id);
    assert.equal(disabled.location.source.getText(disabled.location.span),
        '#define _shared_h_\nTYPE GuardedType FIXED;\n');
});

test('nested repeat guard retains the complete include-site provenance', () => {
    const root = `MODULE M; PROBLEM;
#include "Outer.h"
#include "Outer.h"
MODEND;`;
    const result = preprocess(root, new Map([
        [outerUri, '#include "Shared.h"\n'],
        [sharedUri, '#ifndef GUARD\n#define GUARD\nTYPE N FIXED;\n#endif\n']
    ]));
    const sharedOccurrences = result.occurrences.filter(item => item.sourceUri === sharedUri);
    assert.equal(sharedOccurrences.length, 2);
    assert.equal(result.inactiveRegions.length, 1);
    assert.equal(result.inactiveRegions[0]!.includeOccurrenceId, sharedOccurrences[1]!.id);
    assert.equal(sharedOccurrences[1]!.sites.length, 2);
});
