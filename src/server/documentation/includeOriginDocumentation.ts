// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import * as path from 'path';
import type { Location } from '../core/location';
import { mapToOriginalLocation } from '../core/sourceOffset';
import { filePathFromUri } from '../utility/uriUtils';
import { md } from './markdownUtils';

/** Only annotate definitions from other physical include files. */
export function appendIncludeOriginDocumentation(
    markdown: string,
    declaration: Location | undefined,
    cursorUri: string,
    rootUri: string
): string {
    if (!declaration) return markdown;
    const declarationUri = mapToOriginalLocation(declaration).source.uri;
    if (declarationUri === cursorUri || declarationUri === rootUri) return markdown;

    const filename = path.basename(filePathFromUri(declarationUri));
    return markdown + md`\n\n**Deklariert in Include-Datei:** \`${filename}\``;
}
