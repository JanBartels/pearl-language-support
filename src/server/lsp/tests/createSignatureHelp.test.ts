// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createSignatureHelp } from '../createSignatureHelp';
import type { CallSignatureHelpContext } from '../../semantic/callSignatureHelpIndex';
import { SemanticTypeKind } from '../../semantic/semanticType';
import type { CallSignatureInformation } from '../../semantic/callSignatureInformation';
import { SourceValue } from '../../core/sourceValue';

const fixed = { kind: SemanticTypeKind.Fixed, precision: undefined } as const;
const procedure: CallSignatureInformation = {
    kind: 'procedure', name: 'P',
    procedureType: {
        kind: SemanticTypeKind.Procedure,
        callingConvention: 'PEARL', hasResult: true, resultType: { kind: SemanticTypeKind.Bit, length: 1 },
        parameters: [{ type: fixed, byIdentification: false }, { type: fixed, byIdentification: true }]
    },
    parameters: [
        { name: new SourceValue('A'), type: fixed, byIdentification: false },
        { name: undefined, type: fixed, byIdentification: true }
    ]
};

function context(
    signatures: readonly CallSignatureInformation[], activeParameter: number
): CallSignatureHelpContext {
    return { call: {} as CallSignatureHelpContext['call'], signatures, activeParameter };
}

test('procedure parameters preserve names and IDENT and mark correct label spans', () => {
    const help = createSignatureHelp(context([procedure], 1));
    assert.equal(help.activeSignature, 0);
    assert.equal(help.activeParameter, 1);
    const signature = help.signatures[0];
    assert.equal(signature.label, 'P(A FIXED, FIXED IDENT) RETURNS(BIT(1))');
    assert.deepEqual(signature.parameters?.map(p =>
        typeof p.label === 'string' ? p.label : signature.label.slice(p.label[0], p.label[1])),
        ['A FIXED', 'FIXED IDENT']);
});

test('builtins expose repeatable arguments and map later positions to repeatable slot', () => {
    const repeated: CallSignatureInformation = {
        kind: 'builtin', name: 'WRITE',
        builtin: { name: 'WRITE', category: 'procedure', availability: 'standard',
            description: '', source: '', signatures: [] },
        signature: { parameters: [ { name: 'Station', type: { kind: 'dation' } } ],
            repeatedParameter: { name: 'Object', type: { kind: 'any' } } }
    };
    const help = createSignatureHelp(context([repeated], 7));
    assert.equal(help.signatures[0].label, 'WRITE(Station DATION, Object ANY...)');
    assert.equal(help.activeParameter, 1);
});

test('unrecognized signature selection is not guessed from raw argument tokens', () => {
    const help = createSignatureHelp(context([procedure, procedure], 3));
    assert.equal(help.signatures.length, 2);
    assert.equal(help.activeSignature, 0);
    assert.equal(help.activeParameter, undefined);
});
