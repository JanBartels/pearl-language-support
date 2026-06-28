// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from './parserBase';
import { ProblemPartNode } from '../ast/problemPartNode';

export class ProblemPartParser extends ParserBase {

    parse(): ProblemPartNode | undefined {

        this.skipTrivia();
        if (!this.acceptKeyword("PROBLEM")) {
            return undefined;
        }

        const node = new ProblemPartNode(
            this.location()
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
