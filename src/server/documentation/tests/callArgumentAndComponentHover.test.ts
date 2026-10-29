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
import { SemanticDiagnosticSeverity } from '../../semantic/semanticDiagnostic';
import { SymbolReferenceCollector } from '../../semantic/symbolReferenceCollector';
import { SymbolReferenceResolver } from '../../semantic/symbolReferenceResolver';
import { AstLookupResultDocumentationProvider } from '../astLookupResultDocumentationProvider';

const logger: Logger = { info() {}, warn() {}, error() {} };

function fixture(body: string) {
    const source = new FileSource('file:///call-hover.pearl', `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const references = new SymbolReferenceResolver().resolve(
        new SymbolReferenceCollector().collect(ast), semantic);
    const at = (fragment: string, identifier: string, occurrence = 0) => {
        const positions = [...source.text.matchAll(new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
        const index = positions[occurrence]?.index;
        assert.notEqual(index, undefined, `Missing fragment ${fragment}`);
        const position = index! + fragment.indexOf(identifier);
        const lookup = ast.lookupSourceValue({ uri: source.uri, offset: position });
        assert.ok(lookup, `Missing lookup at ${fragment}, ${identifier}`);
        return { lookup, markdown: AstLookupResultDocumentationProvider.getDocumentation(lookup, semantic) };
    };
    return {
        at, references, semantic,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

test('CALL and implicit call provide semantic hover and references for a struct actual parameter', () => {
    const f = fixture(`TYPE HS STRUCT[E FIXED];
        HP: PROC(Param HS); IF Param.E == 42 THEN RETURN; FIN; END;
        HPC: PROC; DCL V HS; HP(V); CALL HP(V); END;`);
    assert.deepEqual(f.syntax, []);
    assert.deepEqual(f.errors, []);
    for (const occurrence of [0, 1]) {
        const hover = f.at('HP(V)', 'V', occurrence);
        assert.match(hover.markdown ?? '', /\*\*Symbol:\*\* data object|\*\*Type:\*\* `HS`/);
        assert.match(hover.markdown ?? '', /\*\*Type:\*\* `HS`/);
        assert.match(hover.markdown ?? '', /\*\*Expression type:\*\* `HS`/);
        assert.equal(f.references.lookup(hover.lookup.element)?.kind, 'bound');
    }
});

test('component hover includes the containing named struct type without losing the element type', () => {
    const f = fixture(`TYPE HS STRUCT[E FIXED];
        HP: PROC(Param HS); IF Param.E == 42 THEN RETURN; FIN; END;`);
    assert.deepEqual(f.syntax, []);
    assert.deepEqual(f.errors, []);
    const hover = f.at('Param.E', 'E').markdown;
    assert.match(hover ?? '', /\*\*Symbol:\*\* structure component/);
    assert.match(hover ?? '', /\*\*Type:\*\* `FIXED`/);
    assert.match(hover ?? '', /\*\*Containing structure type:\*\* `HS`/);
});

test('nested aliased components show their immediate owner, not the outer struct', () => {
    const f = fixture(`TYPE Inner STRUCT[E FIXED]; TYPE Outer STRUCT[Meta Inner];
        DCL Obj Outer;
        HP: PROC RETURNS(FIXED); RETURN(Obj.Meta.E); END;`);
    assert.deepEqual(f.syntax, []);
    assert.deepEqual(f.errors, []);
    assert.match(f.at('Obj.Meta.E', 'E').markdown ?? '',
        /\*\*Containing structure type:\*\* `Inner`/);
});

test('complex CALL arguments reuse expression AST hover and binding', () => {
    const f = fixture(`DCL V FIXED;
        HP: PROC(I FIXED); END;
        HPC: PROC; HP(V + 2); END;`);
    assert.deepEqual(f.syntax, []);
    assert.deepEqual(f.errors, []);
    assert.match(f.at('HP(V + 2)', 'V').markdown ?? '', /\*\*Type:\*\* `FIXED`/);
    assert.match(f.at('V + 2', '+').markdown ?? '', /\*\*Expression type:\*\* `FIXED\(15\)`/);
});

test('argument parsing is not committed when identifier-led statement is not a CALL', () => {
    const f = fixture(`DCL A(10) FIXED;
        HP: PROC; A(1) := 2; END;`);
    // Assignment is not supported here yet, but speculative CALL parsing
    // must not produce new diagnostics for its index tokens.
    assert.ok(f.errors.every(problem => !problem.message.includes('Aktualparameter')));
});
