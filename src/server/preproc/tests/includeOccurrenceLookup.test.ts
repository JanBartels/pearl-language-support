// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { IncludeOccurrence } from '../includeOccurrence';
import { findIncludeOccurrenceIdAt } from '../includeOccurrence';

const uri = 'file:///test/Shared.h';
function occurrence(id: string, start: number, end: number): IncludeOccurrence {
    return { id, sourceUri: uri, sites: [], expandedSpan: { start, end } };
}

test('nested include execution uses narrowest matching source span', () => {
    const occurrences = [occurrence('outer', 0, 200), occurrence('inner', 40, 90)];
    assert.equal(findIncludeOccurrenceIdAt(occurrences, uri, { start: 60, end: 67 }), 'inner');
    assert.equal(findIncludeOccurrenceIdAt(occurrences, uri, { start: 120, end: 130 }), 'outer');
    assert.equal(findIncludeOccurrenceIdAt(occurrences, 'file:///other.h', { start: 60, end: 67 }), undefined);
});

test('ambiguous or outside positions cannot be assigned an include identity', () => {
    const overlapping = [occurrence('a', 40, 90), occurrence('b', 40, 90)];
    assert.equal(findIncludeOccurrenceIdAt(overlapping, uri, { start: 60, end: 67 }), undefined);
    assert.equal(findIncludeOccurrenceIdAt(overlapping, uri, { start: 110, end: 130 }), undefined);
});
