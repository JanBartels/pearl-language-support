// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { RepetitionForClauseNode } from "../../../ast/problem/statements/repetitionForClauseNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";
import { lookupBoundSymbol } from "../../../semantic/bindingIndex";
import type { SemanticContext } from "../../../semantic/semanticContext";
import { appendSemanticSymbolDocumentation } from "../../semanticSymbolDocumentation";

export class RepetitionForDocumentationProvider extends DocumentationProvider<RepetitionForClauseNode> {

    override getDocumentation(
        node: RepetitionForClauseNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.forKeyword) {
            return md`
# FOR

Introduces an implicit FIXED control variable in the repetition's own scope.
It must not be declared separately or changed by an assignment.
`;
        }

        if (lookup.element === node.variable) {
            const documentation = md`
# Loop control variable

\`${node.variable?.value}\` is declared implicitly in this repetition.
`;
            const symbol = node.variable && semanticContext
                ? lookupBoundSymbol(semanticContext.bindings, node.variable)
                : undefined;
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(documentation, symbol, semanticContext)
                : documentation + '\n\n**Type:** `FIXED`';
        }

        return undefined;
    }
}
