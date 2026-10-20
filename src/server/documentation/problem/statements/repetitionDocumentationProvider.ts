// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { RepetitionNode } from "../../../ast/problem/statements/repetitionNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class RepetitionDocumentationProvider extends DocumentationProvider<RepetitionNode> {

    override getDocumentation(node: RepetitionNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.repeatKeyword) {
            return md`
# REPEAT

Starts a repetition body with its own scope. Expression semantics are not yet implemented.
`;
        }

        if (lookup.element === node.endKeyword) {
            return md`
# END – Repetition

Closes the repetition introduced by:
` + `\n\n\`\`\`pearl\n${node.headerText()}\n\`\`\`\n`;
        }

        if (lookup.element === node.endIdentifier) {
            return md`
# Repetition identifier

Names this repetition for EXIT statements. Label resolution is not yet implemented.
`;
        }

        return undefined;
    }
}
