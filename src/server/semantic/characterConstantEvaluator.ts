// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
    SemanticConstantKind,
    type CharacterConstantValue
} from './semanticConstantValue';

/**
 * Decodes a PEARL character string constant to its semantic character value.
 *
 * The lexer/parser keeps the literal spelling intact. This evaluator interprets
 * doubled apostrophes and PEARL control-character sequences of the form
 * '\\ ... \\' where hexadecimal digits are consumed in byte pairs.
 */
export class CharacterConstantEvaluator {
    evaluate(literal: string): CharacterConstantValue | undefined {
        if (literal.length < 2 || literal[0] !== "'" || literal[literal.length - 1] !== "'") {
            return undefined;
        }

        const body = literal.substring(1, literal.length - 1);
        let value = '';
        let index = 0;
        let controlSequence = false;

        while (index < body.length) {
            if (!controlSequence) {
                if (body[index] !== "'") {
                    value += body[index];
                    index++;
                    continue;
                }

                if (body[index + 1] === "'") {
                    value += "'";
                    index += 2;
                    continue;
                }

                if (body[index + 1] === '\\') {
                    controlSequence = true;
                    index += 2;
                    continue;
                }

                return undefined;
            }

            const end = body.indexOf("\\'", index);

            if (end < 0) {
                return undefined;
            }

            const hex = body.substring(index, end).replace(/\s+/g, '');

            if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(hex)) {
                return undefined;
            }

            for (let hexIndex = 0; hexIndex < hex.length; hexIndex += 2) {
                const byte = Number.parseInt(hex.substring(hexIndex, hexIndex + 2), 16);
                value += String.fromCharCode(byte);
            }

            controlSequence = false;
            index = end + 2;
        }

        if (controlSequence) {
            return undefined;
        }

        return {
            kind: SemanticConstantKind.Character,
            value
        };
    }
}
