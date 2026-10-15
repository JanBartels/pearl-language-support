// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { TaskDeclarationNode } from "../../../ast/problem/declarations/taskDeclarationNode";

import { lookupBoundSymbol } from "../../../semantic/bindingIndex";
import type { SemanticContext } from "../../../semantic/semanticContext";

import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";
import { appendSemanticConstantValue } from "../../semanticConstantValueDocumentation";
import { appendSemanticSymbolDocumentation } from "../../semanticSymbolDocumentation";

export class TaskDeclarationDocumentationProvider
    extends DocumentationProvider<TaskDeclarationNode> {

    override getDocumentation(
        node: TaskDeclarationNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.taskKeyword) {
            return md`
# TASK

Declares a task.

A task body may contain local declarations followed by statements.

Example:

\`\`\`pearl
Worker: TASK PRIO 10;
    DCL value FIXED;
END;
\`\`\`
`;
        }

        if (lookup.element === node.name) {
            let documentation = md`
# Task

Declares the task \`${node.name.value}\`.
`;

            if (!semanticContext) {
                return documentation;
            }

            const symbol = lookupBoundSymbol(
                semanticContext.bindings,
                node.name
            );

            return symbol
                ? appendSemanticSymbolDocumentation(documentation, symbol, semanticContext)
                : documentation;
        }

        if (lookup.element === node.priorityKeyword) {
            const documentation = md`
# ${node.priorityKeyword?.value ?? "PRIO"}

Defines the task's default priority.

RTOS-UH accepts priorities from 1 to 32767. If no priority is specified, the compiler uses its current
default priority; initially this is 48 and it can be changed by a compiler control comment.
`;

            return appendSemanticConstantValue(
                documentation,
                node.priority
                    ? semanticContext?.constantFixedExpressionValues.get(node.priority)
                    : undefined
            );
        }

        if (lookup.element === node.residentKeyword) {
            return md`
# RESIDENT

RTOS-UH task attribute. Keeps the task workspace after termination so repeated activation
can avoid workspace allocation overhead.
`;
        }

        if (lookup.element === node.mainKeyword) {
            return md`
# MAIN

Marks the task for automatic activation at program or system start.
`;
        }

        if (lookup.element === node.endKeyword) {
            return md`
# END

Ends the task \`${node.name.value}\`.
`;
        }

        return undefined;
    }
}
