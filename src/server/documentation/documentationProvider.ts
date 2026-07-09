// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from '../ast/astNode';
import { AstLookupResult } from '../ast/astLookupResult';

/**
 * Provides end-user documentation for a specific AST node type.
 *
 * The returned string is Markdown. Consumers (e.g. the LSP hover handler)
 * decide how this Markdown is rendered or converted to other formats.
 */
export abstract class DocumentationProvider<T extends AstNode> {

    /**
     * Returns documentation for the specified language element.
     *
     * The implementation may return undefined if the supplied
     * SourceValue is not documented by this AST node.
     */
    abstract getDocumentation(
        node: T,
        lookup: AstLookupResult
    ): string | undefined;

}
