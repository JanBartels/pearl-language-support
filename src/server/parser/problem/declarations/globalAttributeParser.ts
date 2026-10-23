// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from '../../parserBase';
import { GlobalAttributeNode } from '../../../ast/problem/declarations/globalAttributeNode';

/** RTOS-UH supports only the bare GLOBAL attribute, without a module name. */
export class GlobalAttributeParser extends ParserBase {

    override parse(): GlobalAttributeNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('GLOBAL');
        if (!keyword) return undefined;

        // Preserve local parser recovery if a PEARL-report GLOBAL(module)
        // appears. RTOS-UH has no such attribute and the loader resolves
        // links between modules without module-qualified source references.
        if (this.acceptLeftParenthesis()) {
            this.context.problems.error(
                this.location(),
                "RTOS-UH supports only GLOBAL without a module name."
            );
            this.synchronizeGlobalModuleName();
            this.acceptRightParenthesis();
        }

        return new GlobalAttributeNode(this.tokenValue(keyword));
    }

    private synchronizeGlobalModuleName(): void {
        this.synchronize([
            ')', 'INIT', 'INITIAL', 'PRESET', 'TYPE',
            'DCL', 'DECLARE', 'SPC', 'SPECIFY', ',', ';'
        ]);
    }
}
