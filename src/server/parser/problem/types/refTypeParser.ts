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
import { SynchronizationReferenceTargetNode } from "../../../ast/problem/types/synchronizationReferenceTargetNode";
import { SimpleTypeParser } from "./simpleTypeParser";
import { StructTypeParser } from "./structTypeParser";
import { NamedTypeParser } from "./namedTypeParser";
import { ProcedureParameterTypeParser } from "../declarations/procedureParameterTypeParser";
import { VirtualDimensionListParser } from '../dimensions/virtualDimensionListParser';
import { ReferenceArrayTargetNode } from '../../../ast/problem/types/referenceArrayTargetNode';
import { ProblemDataTypeParser } from './problemDataTypeParser';

export class RefTypeParser extends ParserBase {

    override parse(): RefTypeNode | undefined {

        this.skipTrivia();

        const keyword = this.acceptKeyword("REF");

        if (!keyword) {
            return undefined;
        }

        // INV protects the referenced object, not the REF variable.
        // With virtual dimensions, the target qualifier follows the rank:
        // REF (,) INV FIXED (PEARL 90, section 5.9).
        // Keep the already supported REF INV ... spelling as well.
        this.skipTrivia();
        let inv = this.acceptKeyword("INV");
        this.skipTrivia();

        let target: RefTargetTypeNode | undefined;
        if (this.isOperator('(')) {
            const dimensions = new VirtualDimensionListParser(this.context).parse();
            this.skipTrivia();
            const arrayInv = this.acceptKeyword("INV");
            if (arrayInv) {
                if (inv) {
                    this.problems.error(this.location(arrayInv),
                        "Duplicate 'INV' qualifier in REF type.");
                } else {
                    inv = arrayInv;
                }
            }
            const elementType = new ProblemDataTypeParser(this.context).parse();
            if (dimensions && elementType) {
                target = new ReferenceArrayTargetNode(dimensions, elementType);
            }
        } else {
            target = this.parseTarget();
        }

        if (!target) {

            this.problems.error( this.location(), "Expected referenced type after 'REF'." );

            return undefined;
        }

        return new RefTypeNode(
            this.tokenValue(keyword),
            target,
            inv ? this.tokenValue(inv) : undefined
        );
    }

    private parseTarget(): RefTargetTypeNode | undefined {
        this.skipTrivia();
        const task = this.acceptKeyword("TASK");
        if (task) {
            return new TaskReferenceTargetNode(this.tokenValue(task));
        }

        const synchronization = this.acceptKeyword(["SEMA", "BOLT"]);
        if (synchronization) {
            return new SynchronizationReferenceTargetNode(
                this.tokenValue(synchronization)
            );
        }


        if (this.isKeyword('DATION')) {
            return new ProcedureParameterTypeParser(this.context).parse();
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