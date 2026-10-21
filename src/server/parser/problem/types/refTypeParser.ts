// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import {
    RefTargetTypeNode,
    RefTypeNode
} from "../../../ast/problem/types/refTypeNode";

import { ProcedureReferenceTargetNode } from "../../../ast/problem/types/procedureReferenceTargetNode";
import { ProcedureSignatureParser } from "../procedures/procedureSignatureParser";
import { TaskReferenceTargetNode } from "../../../ast/problem/types/taskReferenceTargetNode";
import { SimpleTypeParser } from "./simpleTypeParser";
import { StructTypeParser } from "./structTypeParser";
import { NamedTypeParser } from "./namedTypeParser";

export class RefTypeParser extends ParserBase {

    override parse(): RefTypeNode | undefined {

        this.skipTrivia();

        const keyword = this.acceptKeyword("REF");

        if (!keyword) {
            return undefined;
        }

        const target = this.parseTarget();

        if (!target) {

            this.problems.error( this.location(), "Expected referenced type after 'REF'." );

            return undefined;
        }

        return new RefTypeNode( this.tokenValue(keyword), target );
    }

    private parseTarget(): RefTargetTypeNode | undefined {
        this.skipTrivia();
        const task = this.acceptKeyword("TASK");
        if (task) {
            return new TaskReferenceTargetNode(this.tokenValue(task));
        }


        if (this.isKeyword(['PROC', 'PROCEDURE'])) {
            const signature = new ProcedureSignatureParser(this.context).parse();
            return signature ? new ProcedureReferenceTargetNode(signature) : undefined;
        }

        const simpleType = new SimpleTypeParser( this.context ).parse();

        if (simpleType) {
            return simpleType;
        }

        const structType = new StructTypeParser( this.context ).parse();

        if (structType) {
            return structType;
        }

        return new NamedTypeParser( this.context ).parse();
    }

}