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

Starts a repetition body with its own scope. Loop header expressions are not yet analyzed.
`;
        }

        if (lookup.element === node.endKeyword) {
            return md`
# END

Closes this repetition.
`;
        }

        if (lookup.element === node.endIdentifier) {
            return md`
# Repetition identifier

Names this repetition for EXIT statements. Label resolution is not yet implemented.
`;
        }

        if (node.header.some(token => token === lookup.element)) {
            return md`
# Repetition header

Part of the repetition control. Expression semantics are not yet implemented.
`;
        }

        return undefined;
    }
}
