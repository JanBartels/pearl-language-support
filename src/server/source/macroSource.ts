// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Position } from "../core/position";
import { Span } from "../core/span";
import { Location } from "../core/location";
import { Source } from "./source";

export class MacroSource implements Source {

    constructor(
        private readonly expansion: Location,
        private readonly _text: string
    ) {
    }

    get uri(): string {
        return this.expansion.source.uri;
    }

    get text(): string {
        return this._text;
    }

    get length(): number {
        return this._text.length;
    }

    getText(span?: Span): string {

        if (!span) {
            return this._text;
        }

        return this._text.slice(span.start, span.end);
    }

    mapLocation(_location: Location): Location {
        return this.expansion;
    }

}
