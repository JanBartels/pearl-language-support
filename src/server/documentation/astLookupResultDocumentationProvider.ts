// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../ast/astLookupResult";

export class AstLookupResultDocumentationProvider {

    static getDocumentation(
        result: AstLookupResult
    ): string | undefined {

        const provider =
            result.node.documentationProvider();

        if (!provider) {
            return undefined;
        }

        return provider.getDocumentation(
            result.node,
            result
        );
    }
}
