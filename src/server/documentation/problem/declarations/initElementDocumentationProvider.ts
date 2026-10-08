// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from "../../../core/sourceValue";
import { AstLookupResult } from "../../../ast/astLookupResult";

import { DocumentationProvider } from "../../documentationProvider";
import { appendSemanticConstantValue } from "../../semanticConstantValueDocumentation";

import type { SemanticContext } from "../../../semantic/semanticContext";
import { SymbolKind } from "../../../semantic/symbolKind";

import { InitElementNode } from "../../../ast/problem/declarations/initElementNode";

export class InitElementDocumentationProvider
    extends DocumentationProvider<InitElementNode> {

    override getDocumentation(
        node: InitElementNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {

        switch (node.value.kind) {

            case "constantFixedExpression":
                return undefined;

            case "identifier":
                if (lookup.element === node.value.identifier) {
                    return this.getIdentifierDocumentation(
                        node.value.identifier,
                        semanticContext
                    );
                }

                break;

            case "floatingPoint":

                if (lookup.element === node.value.literal) {
                    return `
# FLOAT initialization value

Floating-point constant \`${node.value.literal.value}\` in an initialization list.
`;
                }

                break;

            case "characterString":

                if (lookup.element === node.value.literal) {
                    return `
# Character initialization value

Character string constant in an initialization list.
`;
                }

                break;

            case "bitString":

                if (lookup.element === node.value.literal) {
                    return `
# BIT initialization value

Bit string constant \`${node.value.literal.value}\` in an initialization list.
`;
                }

                break;

            case "clock":
            case "duration":
            case "signedConstantExpression":
                return undefined;
        }

        return undefined;
    }

    private getIdentifierDocumentation(
        identifier: SourceValue<string>,
        semanticContext?: SemanticContext
    ): string {
        const documentation = `
# Initialization identifier

Identifier \`${identifier.value}\` used in an initialization list.

Its meaning depends on the type of the object being initialized and is resolved semantically.
`;

        const symbol = semanticContext?.bindings.get(identifier);

        if (!symbol || symbol.kind !== SymbolKind.DataObject) {
            return documentation;
        }

        return appendSemanticConstantValue(
            documentation,
            semanticContext?.namedConstantValues.get(symbol)
        );
    }
}
