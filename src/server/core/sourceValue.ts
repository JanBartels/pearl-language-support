// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from './location';
import { SourceOffset, containsSourceOffset } from './sourceOffset';

/**
 * Fachlicher Wert mit optionalem Bezug zum Quelltext.
 *
 * SourceValue wird im Compiler verwendet, um fachliche Werte zusammen
 * mit ihrer Herkunft im Quelltext zu speichern.
 *
 * Die Location ist vorhanden, wenn der Wert unmittelbar aus dem
 * Quelltext stammt. Für implizite oder vom Compiler erzeugte Werte
 * (z. B. Defaultwerte, eingebaute Symbole oder Error-Recovery)
 * bleibt sie undefined.
 */
export class SourceValue<T> {

    constructor(
        readonly value: T,
        readonly location?: Location,
        /** Token position before origin mapping, distinct from the public source location. */
        readonly lexicalLocation?: Location
    ) {
    }

    public static synthetic<T>(value: T): SourceValue<T> {
        return new SourceValue(value);
    }

    contains(position: SourceOffset): boolean {
        return containsSourceOffset(this.location, position);
    }    
}
