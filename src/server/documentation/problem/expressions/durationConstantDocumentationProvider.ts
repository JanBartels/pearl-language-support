// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { DurationConstantNode } from '../../../ast/problem/expressions/durationConstantNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticConstantValue } from '../../semanticConstantValueDocumentation';

export class DurationConstantDocumentationProvider
    extends DocumentationProvider<DurationConstantNode> {
    override getDocumentation(
        node: DurationConstantNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        const component = node.components.find(
            value => lookup.element === value.value || lookup.element === value.unit
        );

        if (!component) {
            return undefined;
        }

        const source = node.components
            .map(value => `${value.value.value} ${value.unit.value}`)
            .join(' ');

        const documentation = `
# DURATION constant

Duration constant \`${source}\`.

The units occur in the order \`HRS\`, \`MIN\`, \`SEC\`; omitted units are permitted.
`;

        return appendSemanticConstantValue(
            documentation,
            semanticContext?.timeConstantValues.get(node)
        );
    }
}
