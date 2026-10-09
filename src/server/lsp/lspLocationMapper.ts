// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Location as LspLocation } from 'vscode-languageserver';

export function mapLspLocation(location: Location, registry: DocumentRegistry): LspLocation | undefined {
    const mapped = mapToOriginalLocation(location);
    const document = registry.get(mapped.source.uri);

    if (!document) {
        return undefined;
    }

    return {
        uri: mapped.source.uri,
        range: {
            start: document.positionAt(mapped.span.start),
            end: document.positionAt(mapped.span.end)
        }
    };
}

function mapToOriginalLocation(location: Location): Location {
    let current = location;

    for (;;) {
        const mapped = current.source.mapLocation(current);

        if (sameLocation(mapped, current)) {
            return current;
        }

        current = mapped;
    }
}

function sameLocation(left: Location, right: Location): boolean {
    return left.source === right.source
        && left.span.start === right.span.start
        && left.span.end === right.span.end;
}
