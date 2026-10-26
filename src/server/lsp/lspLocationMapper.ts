// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';
import { mapToOriginalLocation } from '../core/sourceOffset';
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

