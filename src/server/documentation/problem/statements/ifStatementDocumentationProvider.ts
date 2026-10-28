// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { IfStatementNode } from "../../../ast/problem/statements/ifStatementNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class IfStatementDocumentationProvider extends DocumentationProvider<IfStatementNode> {

    override getDocumentation(node: IfStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.ifKeyword) {
            return md`
# IF

Conditional statement. The condition must have type BIT(1).
`;
        }

        if (node.conditionTokens.includes(lookup.element as typeof node.conditionTokens[number])) {
            return md`
# IF condition

The condition is analyzed as an expression whenever its syntax is supported.
`;
        }

        if (lookup.element === node.thenKeyword) {
            return md`
# THEN

Statements executed when the IF condition is true.
`;
        }

        if (lookup.element === node.elseKeyword) {
            return md`
# ELSE

Optional statements executed when the IF condition is false.

The corresponding IF condition is:
` + `\n\n\`\`\`pearl\nIF ${node.conditionText()} THEN\n\`\`\`\n`;
        }

        if (lookup.element === node.finKeyword) {
            return md`
# FIN – IF

Closes the conditional statement with condition:
` + `\n\n\`\`\`pearl\nIF ${node.conditionText()} THEN\n\`\`\`\n`;
        }

        return undefined;
    }
}
