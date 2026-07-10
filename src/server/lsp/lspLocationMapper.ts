// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Location as LspLocation } from 'vscode-languageserver';

export function mapLspLocation(
    location: Location,
    registry: DocumentRegistry
): LspLocation | undefined {

    const document = registry.get(location.source.uri);

    if (!document) {
        return undefined;
    }

    const { source, span } = location;

    return {
        uri: source.uri,
        range: {
            start: document.positionAt(span.start),
            end: document.positionAt(span.end)
        }
    };
}
