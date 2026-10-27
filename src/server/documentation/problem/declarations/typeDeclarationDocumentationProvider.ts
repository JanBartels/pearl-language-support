// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import type { CallSignatureIndex } from '../../../semantic/callSignatureIndex';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { formatCallSignatures } from '../../callSignatureFormatting';

import { TypeDeclarationNode } from "../../../ast/problem/declarations/typeDeclarationNode";

export class TypeDeclarationDocumentationProvider
    extends DocumentationProvider<TypeDeclarationNode> {

    override getDocumentation(
        node: TypeDeclarationNode,
        lookup: AstLookupResult,
        _semanticContext?: SemanticContext,
        callSignatures?: CallSignatureIndex
    ): string | undefined {

        if (lookup.element === node.keyword) {
            return md`
# TYPE

Defines a named data type.

Example:

\`\`\`pearl
TYPE Counter FIXED(31);
\`\`\`
`;
        }

        if (lookup.element === node.name) {
            const documentation = md`
# Type definition

Defines the data type \`${node.name.value}\`.
`;
            const signature = formatCallSignatures(callSignatures?.getForElement(node.name));
            return signature ? `${documentation}\n\n**Signature:** \`${signature}\`` : documentation;
        }

        return undefined;
    }
}
