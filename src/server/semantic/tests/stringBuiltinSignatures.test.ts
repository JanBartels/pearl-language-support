// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { lookupBuiltin } from '../builtins/builtinCatalog';
import { formatBuiltinSignature, matchBuiltinSignature } from '../builtins/builtinSignature';
import { SemanticTypeKind } from '../semanticType';
import type { SemanticType } from '../semanticType';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticSeverity, SemanticDiagnosticCode } from '../semanticDiagnostic';
import { ProblemCollection } from '../../core/problemCollection';
import { FileSource } from '../../source/fileSource';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
const char = (length: number): SemanticType => ({ kind: SemanticTypeKind.Character, length });
const fixed = (precision: number): SemanticType => ({ kind: SemanticTypeKind.Fixed, precision });
const names = ['BEG', 'INSTR', 'LEN', 'MID', 'KON', 'INSER', 'CMPW'] as const;
const parameterCount = [1, 6, 1, 3, 6, 6, 6] as const;

function analyze(body: string) {
    const source = new FileSource('file:///string-builtin-signatures.P',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(),
        source, context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast, context.activeBlockComments);
    return { syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error) };
}

test('string builtins have implementation-oriented value parameters and return types', () => {
    names.forEach((name, index) => {
        const definition = lookupBuiltin(name);
        assert.ok(definition, `missing ${name}`);
        assert.equal(definition.signatures.length, 1);
        const signature = definition.signatures[0];
        assert.equal(signature.parameters.length, parameterCount[index]);
        assert.ok(signature.parameters.every(p => !p.byIdentification),
            `${name} still requires IDENT`);
        assert.equal(signature.result?.kind, 'type');
        if (signature.result?.kind !== 'type') return;
        const result = signature.result.type;
        assert.equal(result.kind, ['MID', 'KON', 'INSER'].includes(name)
            ? 'character' : 'fixed');
        if (result.kind === 'fixed') assert.deepEqual(result.precisions, [15]);
        if (result.kind === 'character') assert.equal(result.length, undefined);
        assert.doesNotMatch(formatBuiltinSignature(definition, signature), /IDENT/);
    });
});

test('string builtin parameter names match the documented interface names', () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
        BEG: ['string'],
        LEN: ['string'],
        MID: ['string', 'anf', 'end'],
        INSTR: ['string1', 'anf1', 'end1', 'string2', 'anf2', 'end2'],
        KON: ['string1', 'anf1', 'end1', 'string2', 'anf2', 'end2'],
        INSER: ['string1', 'anf1', 'end1', 'string2', 'anf2', 'end2'],
        CMPW: ['string1', 'anf1', 'end1', 'string2', 'anf2', 'end2']
    };
    for (const [name, parameterNames] of Object.entries(expected)) {
        const builtin = lookupBuiltin(name)!;
        assert.deepEqual(builtin.signatures[0].parameters.map(parameter => parameter.name),
            parameterNames, `${name}: parameter names must stay in their declared order`);
        const signature = formatBuiltinSignature(builtin, builtin.signatures[0]);
        for (const parameterName of parameterNames) {
            assert.match(signature, new RegExp(`\\b${parameterName}\\s`));
        }
    }
});

test('string signatures preserve the order and precise types of all slice parameters', () => {
    for (const name of ['INSTR', 'KON', 'INSER', 'CMPW']) {
        const definition = lookupBuiltin(name)!;
        assert.deepEqual(definition.signatures[0].parameters.map(p => p.type.kind),
            ['character', 'fixed', 'fixed', 'character', 'fixed', 'fixed']);
        assert.ok(matchBuiltinSignature(definition,
            [char(10), fixed(15), fixed(15), char(4), fixed(15), fixed(15)]));
        assert.equal(matchBuiltinSignature(definition,
            [char(10), fixed(31), fixed(15), char(4), fixed(15), fixed(15)]), undefined);
    }
});

test('CHAR(*) results stay of unknown length instead of fabricating CHAR(255)', () => {
    for (const name of ['MID', 'KON', 'INSER']) {
        const definition = lookupBuiltin(name)!;
        const types = name === 'MID'
            ? [char(10), fixed(15), fixed(15)]
            : [char(10), fixed(15), fixed(15), char(4), fixed(15), fixed(15)];
        assert.deepEqual(matchBuiltinSignature(definition, types)?.resultType,
            { kind: SemanticTypeKind.Character, length: undefined });
    }
    assert.deepEqual(matchBuiltinSignature(lookupBuiltin('CMPW')!,
        [char(10), fixed(15), fixed(15), char(4), fixed(15), fixed(15)])?.resultType,
        { kind: SemanticTypeKind.Fixed, precision: 15 });
});

test('string builtins allow literal strings and FIXED(15) value expressions', () => {
    const result = analyze(`R: PROC;
        DCL C CHAR(20); DCL I FIXED; DCL P REF CHAR(20);
        I = BEG('  a');
        I = LEN('abc');
        I = INSTR(P, 1, 3, 'abc', 1, 3);
        C = MID('abcd', 1, 2);
        C = KON('abcd', 1, 2, '1234', 1, 2);
        C = INSER('abcd', 1, 2, '1234', 1, 2);
        I = CMPW('abcd', 1, 2, '1234', 1, 2);
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('string builtins still reject wrong argument types and precisions', () => {
    const result = analyze(`R: PROC;
        DCL C CHAR(10);
        C = MID('abcd', 1(31), 2);
        C = MID(123, 1, 2);
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidBuiltinArgumentType,
        SemanticDiagnosticCode.InvalidBuiltinArgumentType
    ]);
});
