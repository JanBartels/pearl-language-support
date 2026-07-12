// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
    PreprocessorConditionalLookupResult,
    PreprocessorDirectiveKind
} from "../preproc/preprocessorConditionalLookupResult";

import { md } from "./markdownUtils";

export class PreprocessorConditionalBlockDocumentationProvider {

    static getDocumentation(
        result: PreprocessorConditionalLookupResult
    ): string {

        const block = result.block;

        const directive =
            block.ifdef ? "#ifdef" : "#ifndef";

        const evaluation =
            block.conditionSatisfied
                ? "Bedingung erfüllt."
                : "Bedingung nicht erfüllt.";

        const macroDefinition =
            block.macroDefinition
                ? md`
\`\`\`pearl
#define ${block.macroDefinition.name}${block.macroDefinition.replacement === null
    ? ""
    : " " + block.macroDefinition.replacement}
\`\`\`
`
                : "Makro ist nicht definiert.";

        switch (result.directive) {

            case PreprocessorDirectiveKind.Ifdef:
            case PreprocessorDirectiveKind.Ifndef:

                return md`
# ${directive}

\`\`\`pearl
${directive} ${block.macro}
\`\`\`

${evaluation}

${macroDefinition}
`;

            case PreprocessorDirectiveKind.Else:

                return md`
# #else

Gehört zu

\`\`\`pearl
${directive} ${block.macro}
\`\`\`

${evaluation}

${macroDefinition}
`;

            case PreprocessorDirectiveKind.Endif:

                return md`
# #endif

Schließt

\`\`\`pearl
${directive} ${block.macro}
\`\`\`

${evaluation}

${block.elseLocation
    ? "Der Block enthält einen `#else`-Zweig."
    : "Der Block besitzt keinen `#else`-Zweig."}

${macroDefinition}
`;
        }
    }
}
