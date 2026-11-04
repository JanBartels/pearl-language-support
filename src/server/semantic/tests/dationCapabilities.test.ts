// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dationCreationCompatible, dationHasClass, dationSupportsDirection } from '../dationCapabilities';
import type { DationType } from '../semanticType';
import { SemanticTypeKind } from '../semanticType';

function dation(direction: DationType['direction'], dationClass: DationType['dationClass']): DationType {
    return { kind: SemanticTypeKind.Dation, direction, dationClass };
}

test('DATION directions and classes are distinct capabilities', () => {
    assert.equal(dationSupportsDirection(dation('INOUT', 'ALL'), 'IN'), true);
    assert.equal(dationSupportsDirection(dation('OUT', 'ALPHIC'), 'IN'), false);
    assert.equal(dationSupportsDirection(dation(undefined, 'ALPHIC'), 'OUT'), true);
    assert.equal(dationHasClass(dation('IN', 'ALL'), 'ALL'), true);
    assert.equal(dationHasClass(dation('IN', 'ALL'), 'ALPHIC'), false);
    assert.equal(dationHasClass(dation('IN', 'ALL'), 'BASIC'), false);
});

test('CREATED permits direction narrowing but not class changes or direction widening', () => {
    const system = dation('INOUT', 'ALL');
    assert.equal(dationCreationCompatible(dation('IN', 'ALL'), system), true);
    assert.equal(dationCreationCompatible(dation('OUT', 'ALL'), system), true);
    assert.equal(dationCreationCompatible(dation('INOUT', 'ALL'), system), true);
    assert.equal(dationCreationCompatible(dation('IN', 'ALL'), dation('OUT', 'ALL')), false);
    assert.equal(dationCreationCompatible(dation('INOUT', 'ALL'), dation('OUT', 'ALL')), false);
    assert.equal(dationCreationCompatible(dation('IN', 'BASIC'), dation('IN', 'ALL')), false);
    assert.equal(dationCreationCompatible(dation('IN', 'ALPHIC'), dation('IN', 'BASIC')), false);
});
