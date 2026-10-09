// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from '../../parserBase';

import { SpcProblemDataAttributeNode } from '../../../ast/problem/specifications/spcProblemDataAttributeNode';

import { GlobalAttributeParser } from '../declarations/globalAttributeParser';
import { InitializationAttributeParser } from '../declarations/initializationAttributeParser';
import { ProblemDataTypeParser } from '../types/problemDataTypeParser';

export class SpcProblemDataAttributeParser extends ParserBase {
    override parse(): SpcProblemDataAttributeNode | undefined {
        this.skipTrivia();

        const invToken = this.acceptKeyword('INV');
        const type = new ProblemDataTypeParser(this.context).parse();

        if (!type) {
            if (!invToken) {
                return undefined;
            }

            this.problems.error(this.location(), "Expected problem data type after 'INV'.");
            return new SpcProblemDataAttributeNode(this.tokenValue(invToken), undefined, undefined);
        }

        let global = new GlobalAttributeParser(this.context).parse();

        this.skipTrivia();
        if (this.isKeyword(['INIT', 'INITIAL'])) {
            this.problems.error(this.location(), 'Initialization attribute is not allowed in SPC.');
            new InitializationAttributeParser(this.context).parse();

            if (!global) {
                global = new GlobalAttributeParser(this.context).parse();
            }
        }

        return new SpcProblemDataAttributeNode(invToken ? this.tokenValue(invToken) : undefined, type, global);
    }
}
