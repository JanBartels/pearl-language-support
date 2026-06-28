// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from './parserBase';

/**
 * Basisklasse für Parser, die den Rest einer bereits begonnenen
 * grammatischen Produktion verarbeiten.
 *
 * TailParser werden nicht direkt aufgerufen. Der gemeinsame Präfix
 * wurde bereits vom aufrufenden Parser konsumiert.
 */
export abstract class TailParser extends ParserBase {

    override parse(): never {
        throw new Error(`${this.constructor.name} does not support parse().`);
    }
}
