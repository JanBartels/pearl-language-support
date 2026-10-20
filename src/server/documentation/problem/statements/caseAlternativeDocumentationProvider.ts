// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { CaseAlternativeNode } from "../../../ast/problem/statements/caseAlternativeNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class CaseAlternativeDocumentationProvider extends DocumentationProvider<CaseAlternativeNode> {

    override getDocumentation(node: CaseAlternativeNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.altKeyword) {
            const selector = node.caseSelectorText();
            const caseContext = selector === undefined
                ? ""
                : `\n\nZugehöriger CASE-Selektor:\n\n\`\`\`pearl\nCASE ${selector}\n\`\`\`\n`;

            if (node.caseListTokens) {
                return md`
# ALT – indexed

Alternative selected when the CASE value matches one of the listed values or ranges.
` + `\n\n\`\`\`pearl\nALT ${node.caseListText()}\n\`\`\`\n` + caseContext;
            }
            return md`
# ALT – Fall ${node.position}

Positionale Alternative Nummer **${node.position}** der CASE-Anweisung.
` + caseContext;
        }

        if (node.caseListTokens?.includes(lookup.element as typeof node.altKeyword)) {
            return md`
# ALT case list

Selection values and ranges. Their semantic validity is not checked yet.
`;
        }
        return undefined;
    }
}
