// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from '../ast/astNode';
import { AstLookupResult } from '../ast/astLookupResult';
import type { SemanticContext } from '../semantic/semanticContext';

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
     *
     * Semantic information is optional so documentation remains usable
     * for syntactically valid but not yet semantically analyzed trees.
     */
    abstract getDocumentation(
        node: T,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined;

}
