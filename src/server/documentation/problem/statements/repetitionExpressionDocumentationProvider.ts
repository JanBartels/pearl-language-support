// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { RepetitionExpressionClauseNode } from
    "../../../ast/problem/statements/repetitionExpressionClauseNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

const DESCRIPTIONS: Readonly<Record<string, string>> = {
    FROM: "Initial value of the loop control variable (default: 1).",
    BY: "Increment of the loop control variable (default: 1).",
    TO: "Final value of the loop control variable.",
    WHILE: "Condition that controls whether the repetition continues."
};

export class RepetitionExpressionDocumentationProvider
    extends DocumentationProvider<RepetitionExpressionClauseNode> {

    override getDocumentation(
        node: RepetitionExpressionClauseNode,
        lookup: AstLookupResult
    ): string | undefined {
        if (lookup.element !== node.keyword
            && !node.expressionTokens.some(token => lookup.element === token)) {
            return undefined;
        }

        return md`
# ${node.keyword.value}

${DESCRIPTIONS[node.keyword.value] ?? "Repetition control clause."}

${node.expression
    ? node.keyword.value === "WHILE"
        ? "The condition is parsed and checked as a BIT(1) expression."
        : "The expression is parsed and checked as a FIXED expression."
    : "Expression syntax is not yet fully supported."}
`;
    }
}
