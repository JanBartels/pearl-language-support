// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../documentationProvider';
import { AstLookupResult } from '../../ast/astLookupResult';
import { md } from '../markdownUtils';
import { TranslationUnitNode } from '../../ast/module/translationUnitNode';

export class TranslationUnitDocumentationProvider
    extends DocumentationProvider<TranslationUnitNode> {

    override getDocumentation(
        node: TranslationUnitNode,
        lookup: AstLookupResult
    ): string | undefined {

        return undefined;
    }

}
