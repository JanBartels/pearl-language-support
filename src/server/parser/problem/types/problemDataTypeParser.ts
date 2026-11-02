// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { ProblemDataTypeNode } from "../../../ast/problem/types/problemDataTypeNode";

import { SynchronizationTypeParser } from "./synchronizationTypeParser";
import { SimpleTypeParser } from "./simpleTypeParser";
import { StructTypeParser } from "./structTypeParser";
import { NamedTypeParser } from "./namedTypeParser";
import { RefTypeParser } from "./refTypeParser";

export class ProblemDataTypeParser extends ParserBase {

    override parse(): ProblemDataTypeNode | undefined {

        this.skipTrivia();

        const simpleType = new SimpleTypeParser( this.context ).parse();
        if (simpleType) {
            return simpleType;
        }

        const structType = new StructTypeParser( this.context ).parse();
        if (structType) {
            return structType;
        }

        const refType = new RefTypeParser( this.context ).parse();
        if (refType) {
            return refType;
        }

        const synchronizationType = new SynchronizationTypeParser(this.context).parse();
        if (synchronizationType) {
            return synchronizationType;
        }

        return new NamedTypeParser( this.context ).parse();
    }
}