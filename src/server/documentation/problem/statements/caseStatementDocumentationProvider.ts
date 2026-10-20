// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { CaseStatementNode } from "../../../ast/problem/statements/caseStatementNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class CaseStatementDocumentationProvider extends DocumentationProvider<CaseStatementNode> {

    override getDocumentation(node: CaseStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.caseKeyword) {
            return md`
# CASE

Selects an ALT branch using either its position or an explicit list of selection values.
The selector expression is not semantically checked yet.
`;
        }

        if (node.selectorTokens.includes(lookup.element as typeof node.selectorTokens[number])) {
            return md`
# CASE selector

The selector is preserved for later expression and type analysis.
`;
        }

        if (lookup.element === node.finKeyword) {
            return md`
# FIN – CASE

Closes the CASE selection introduced by:
` + `\n\n\`\`\`pearl\nCASE ${node.selectorText()}\n\`\`\`\n`;
        }

        return undefined;
    }
}
