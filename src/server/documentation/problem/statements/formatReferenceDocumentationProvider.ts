// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { FormatReferenceNode } from '../../../ast/problem/statements/formatReferenceNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { SymbolKind } from '../../../semantic/symbolKind';
import { DocumentationProvider } from '../../documentationProvider';

/** FORMAT names are navigable symbols, not ordinary value expressions. */
export class FormatReferenceDocumentationProvider extends DocumentationProvider<FormatReferenceNode> {
    override getDocumentation(node: FormatReferenceNode, lookup: AstLookupResult,
        semanticContext?: SemanticContext): string | undefined {
        if (lookup.element !== node.identifier) return undefined;
        const bound = semanticContext?.bindings.get(node.identifier);
        const name = node.identifier.value;
        return bound?.kind === SymbolKind.Format
            ? `# ${name}\n\nReferenz auf die FORMAT-Deklaration \`${name}\` (R-Format).`
            : `# R(${name})\n\nReferenz auf eine FORMAT-Deklaration.`;
    }
}
