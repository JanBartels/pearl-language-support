// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { FoldingRange } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { FoldingRegion } from '../folding/foldingRegion';

export function mapFoldingRegion(
    document: TextDocument,
    region: FoldingRegion
): FoldingRange | undefined {

    const start = document.positionAt(region.location.span.start);
    const end = document.positionAt(region.location.span.end);

    if (start.line >= end.line) {
        return undefined;
    }

    return {
        startLine: start.line,
        endLine: end.line-1
    };
}
