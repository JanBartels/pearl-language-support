// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from './parserBase';
import { SystemPartNode } from '../ast/systemPartNode';

export class SystemPartParser extends ParserBase {

    parse(): SystemPartNode | undefined {

    this.skipTrivia();
    if (!this.acceptKeyword("SYSTEM")) {
        return undefined;
    }

    const node = new SystemPartNode(
        this.location()
    );

    this.expectOperator(";");

    while (!this.eof()) {

        if (this.isKeyword("PROBLEM") ||
            this.isKeyword("MODEND")) {
            break;
        }

        this.next();
    }

    return node;
}
}
