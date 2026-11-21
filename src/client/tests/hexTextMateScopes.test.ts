// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const grammar = JSON.parse(readFileSync(join(process.cwd(), 'syntaxes/pearl.tmLanguage.json'), 'utf8'));
const repository = grammar.repository;
const hexScope = 'constant.numeric.hex.pearl';

function asRegExp(pattern: string): RegExp {
    return new RegExp(pattern);
}

test('hex contexts precede generic integer matching', () => {
    const includes = grammar.patterns.map((pattern: { include: string }) => pattern.include);
    assert.ok(includes.indexOf('#moduleHexHeader') < includes.indexOf('#numbers'));
    assert.ok(includes.indexOf('#systemHexParameters') < includes.indexOf('#numbers'));
    assert.ok(includes.indexOf('#comments') < includes.indexOf('#moduleHexHeader'));
});

test('EV and BU color only their first argument as hexadecimal', () => {
    const rule = repository.systemHexParameters.patterns[0];
    const match = asRegExp(rule.match);
    for (const [input, expected] of [
        ['EV(12345678)', '12345678'],
        ['EV(12AB5678)', '12AB5678'],
        ['EV(6)', '6'],
        ['BU(FF0F0006,8)', 'FF0F0006'],
        ['BU(0240FFFC)', '0240FFFC'],
    ]) {
        const groups = match.exec(input);
        assert.ok(groups, `expected ${input} to match`);
        assert.equal(groups[3], expected);
        assert.equal(rule.captures['3'].name, hexScope);
    }
    assert.equal(match.exec('BU(123456789,8)'), null);
    assert.equal(match.exec('EV(12G5678)'), null);
    const matched = match.exec('BU(FF0F0006,8)');
    assert.ok(matched);
    assert.equal('BU(FF0F0006,8)'.slice(matched[0].length), ',8)', 'decimal BU access code is not captured');
});

test('S/SC module options and CODE/VAR have the hex scope only within a header', () => {
    const header = repository.moduleHexHeader.patterns[0];
    const begin = asRegExp(header.begin);
    const nested = header.patterns[0];
    const option = asRegExp(nested.match);
    for (const input of ['S=$6500,CODE=$A000,VAR=$C000;', 'SC=6500,CODE=FA0000,VAR=3000;']) {
        const head = begin.exec(input);
        assert.ok(head, input);
        assert.ok(['S', 'SC'].includes(head[2]));
        assert.equal(header.beginCaptures['4'].name, hexScope);
        const options = [...input.matchAll(new RegExp(nested.match, 'g'))];
        assert.deepEqual(options.map((match) => match[1]), ['CODE', 'VAR']);
        assert.equal(nested.captures['3'].name, hexScope);
    }
    assert.equal(begin.exec('DCL CODE FIXED INIT(12345678);'), null);
    assert.equal(option.exec('CODE=G000;'), null);
    assert.equal(header.end, ';');
});

test('RTOS-UH R option in a comment receives a targeted hex scope', () => {
    const comments = repository.comments.patterns;
    const specialIndex = comments.findIndex((rule: { begin: string }) => rule.begin?.includes('[+-]R'));
    const genericIndex = comments.findIndex((rule: { begin: string }) => rule.begin === '/\\*');
    assert.ok(specialIndex >= 0 && specialIndex < genericIndex);
    const special = comments[specialIndex];
    const start = asRegExp(special.begin);
    for (const [input, value] of [
        ['/*+R=$5000 20 kByte */', '$5000'],
        ['/*-R5000 Gleiche Wirkung */', '5000'],
        ['/*-R=ABCD Kommentar */', 'ABCD'],
    ]) {
        const result = start.exec(input);
        assert.ok(result, input);
        assert.equal(result[3], value);
    }
    assert.equal(special.beginCaptures['3'].name, hexScope);
    assert.equal(start.exec('/*+R=ABCD*/'), null, 'R option requires a blank after the value');
    assert.equal(start.exec('/* ordinary comment */'), null);
});

test('ordinary PEARL numbers, prefixed hex and BIT literals remain distinct', () => {
    const numberPatterns = repository.numbers.patterns;
    const decimal = numberPatterns.find((rule: { name: string }) => rule.name === 'constant.numeric.integer.pearl');
    const prefixed = numberPatterns.find((rule: { name: string }) => rule.name === hexScope);
    const bit = repository.bitstrings.patterns[0];
    assert.ok(asRegExp(decimal.match).test('12345678'));
    assert.ok(asRegExp(prefixed.match).test('$3C00'));
    assert.equal(bit.name, 'constant.numeric.bitstring.pearl');
    assert.ok(asRegExp(bit.match).test("'00AF'B4"));
});
