// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { CaseOutNode } from "../../../ast/problem/statements/caseOutNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class CaseOutDocumentationProvider extends DocumentationProvider<CaseOutNode> {

    override getDocumentation(node: CaseOutNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.outKeyword) {
            const selector = node.caseSelectorText();
            return md`
# OUT

Optional default branch when none of the CASE alternatives matches.
` + (selector === undefined
                ? ""
                : `\n\nZugehöriger CASE-Selektor:\n\n\`\`\`pearl\nCASE ${selector}\n\`\`\`\n`);
        }
        return undefined;
    }
}
