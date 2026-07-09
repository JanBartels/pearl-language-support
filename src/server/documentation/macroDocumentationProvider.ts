// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { MacroReference } from '../preproc/macroReference';
import { md } from './markdownUtils';

export class MacroDocumentationProvider {

    static getDocumentation(
        macro: MacroReference
    ): string {

        if (macro.definition.replacement === null) {

            return md`
# Macro

\`\`\`pearl
#define ${macro.definition.name}
\`\`\`
`;
        }

        return md`
# Macro

\`\`\`pearl
#define ${macro.definition.name} ${macro.definition.replacement}
\`\`\`
`;
    }
}
