// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from '../parserBase';
import { ProblemPartNode } from '../../ast/problem/problemPartNode';

export class ProblemPartParser extends ParserBase {

    parse(): ProblemPartNode | undefined {

        this.skipTrivia();
        const problemKeyword = this.acceptKeyword("PROBLEM");
        if (!problemKeyword) {
            return undefined;
        }

        const node = new ProblemPartNode(
            this.tokenValue( problemKeyword )
        );

        this.skipTrivia();
        if (!this.expectOperator(";")) {
            this.synchronize([
                "MODEND"
            ]);
        }

        while (!this.eof()) {

            if (this.isKeyword("MODEND")) {
                break;
            }

            this.next();
        }

        return node;
    }
}
