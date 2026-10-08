// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { ClockConstantNode } from '../../../ast/problem/expressions/clockConstantNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticConstantValue } from '../../semanticConstantValueDocumentation';

export class ClockConstantDocumentationProvider
    extends DocumentationProvider<ClockConstantNode> {
    override getDocumentation(
        node: ClockConstantNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (
            lookup.element !== node.hours
            && lookup.element !== node.minutes
            && lookup.element !== node.seconds
        ) {
            return undefined;
        }

        const documentation = `
# CLOCK constant

Time-of-day constant \`${node.hours.value}:${node.minutes.value}:${node.seconds.value}\`.

Hours are interpreted modulo 24. Minutes and seconds must be in the range 0 to less than 60.
`;

        return appendSemanticConstantValue(
            documentation,
            semanticContext?.timeConstantValues.get(node)
        );
    }
}
