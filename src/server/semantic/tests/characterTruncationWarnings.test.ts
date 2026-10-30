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
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { defaultSettings } from '../../settings/pearlSettings';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(code: string, warnOnCharTruncation?: boolean) {
    const source = new FileSource('file:///char-warnings.pearl',
        `MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const options = warnOnCharTruncation === undefined
        ? {} : { warnOnCharTruncation };
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments, options);
    return {
        syntax: problems.toArray(),
        diagnostics: semantic.diagnostics,
        warnings: semantic.diagnostics.filter(d => d.code === SemanticDiagnosticCode.PossibleCharacterTruncation),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

const truncation = SemanticDiagnosticCode.PossibleCharacterTruncation;

test('warning enabled by default, including VS Code settings default', () => {
    assert.equal(defaultSettings.warnOnCharTruncation, true);
    const result = analyze(`R: PROC;
        DCL Short CHAR(3), Long CHAR(8);
        Short := Long;
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings.map(w => w.code), [truncation]);
    assert.match(result.warnings[0].message, /CHAR\(8\).*CHAR\(3\)/);
});

test('no warning for widening, equal lengths or incompatible BIT assignment', () => {
    const r = analyze(`R: PROC;
        DCL Short CHAR(3), Long CHAR(8), B4 BIT(4), B8 BIT(8);
        Long := Short;
        Long := Long;
        B4 := B8;
    END;`);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.errors.length, 1);
});

test('CHAR literals warn only when too long for the target', () => {
    const r = analyze(`R: PROC;
        DCL Short CHAR(3);
        Short := '12';
        Short := '123';
        Short := '1234';
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].message, /CHAR\(4\).*CHAR\(3\)/);
});

test('CALL and function value parameters share the warning, but IDENT stays exact', () => {
    const r = analyze(`P: PROC(Str CHAR(3)); END;
        Q: PROC(Str CHAR(3) IDENT); END;
        F: PROC(Str CHAR(3)) RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED);
            DCL Short CHAR(1), Long CHAR(8), PLong REF CHAR(8);
            P(Short);
            P(Long);
            P(PLong);
            P('1234');
            Q(Long);
            RETURN(F(Long));
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.warnings.length, 4);
    assert.ok(r.warnings.every(w => w.code === truncation));
    assert.ok(r.warnings.every(w => /Aktualparameter 1/.test(w.message)));
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /IDENT|Aktualparameter/);
});

test('RETURN CHAR truncation warns but remains legal', () => {
    const r = analyze(`R: PROC(C CHAR(9)) RETURNS(CHAR(2)); RETURN(C); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].message, /RETURN/);
});

test('nested source REF CHAR is dereferenced once for truncation warnings', () => {
    const r = analyze(`R: PROC;
        DCL Short CHAR(3), Long REF CHAR(9);
        Short := Long;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].message, /CHAR\(9\).*CHAR\(3\)/);
});

test('warning disabled via semantic options suppresses only truncation diagnostics', () => {
    const r = analyze(`R: PROC;
        DCL Short CHAR(3), Long CHAR(8), B4 BIT(4), B8 BIT(8);
        Short := Long;
        B4 := B8;
    END;`, false);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.errors.length, 1);
});

test('real-world CHAR(128)/CHAR(255) and literal argument examples', () => {
    const r = analyze(`CharTest2: PROC(Str CHAR(3)); END;
        CharTest: PROC;
            DCL Short CHAR(128), Long CHAR(255);
            Short = Long;
            Long = Short;
            CharTest2('12');
            CharTest2('123');
            CharTest2('1234');
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.equal(r.warnings.length, 2);
    assert.match(r.warnings[0].message, /CHAR\(255\).*CHAR\(128\)/);
    assert.match(r.warnings[1].message, /CHAR\(4\).*CHAR\(3\)/);
});
