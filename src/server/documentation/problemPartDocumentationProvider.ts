// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from './documentationProvider';
import { AstLookupResult } from '../ast/astLookupResult';
import { md } from './markdownUtils';
import { ProblemPartNode } from '../ast/problemPartNode';

export class ProblemPartDocumentationProvider
    extends DocumentationProvider<ProblemPartNode> {

    override getDocumentation(
        node: ProblemPartNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element===node.keyword) {
            return md`
# PROBLEM

Marks the beginning of the **PROBLEM** part of a PEARL module.

The PROBLEM part contains the executable program, including
declarations, statements, procedures and tasks.
`;
        }

        return undefined;
    }

}
