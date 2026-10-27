// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { RefTypeDocumentationProvider } from "../../../documentation/problem/types/refTypeDocumentationProvider";

import { ProcedureReferenceTargetNode } from "./procedureReferenceTargetNode";
import { TaskReferenceTargetNode } from "./taskReferenceTargetNode";
import { SynchronizationReferenceTargetNode } from "./synchronizationReferenceTargetNode";
import { SimpleTypeNode } from "./simpleTypeNode";
import { NamedTypeNode } from "./namedTypeNode";
import { StructTypeNode } from "./structTypeNode";
import { ProcedureParameterTypeNode } from "../declarations/procedureParameterTypeNode";

export type RefTargetTypeNode =
    | SimpleTypeNode
    | NamedTypeNode
    | StructTypeNode
    | TaskReferenceTargetNode
    | SynchronizationReferenceTargetNode
    | ProcedureReferenceTargetNode
    | ProcedureParameterTypeNode
    ;

export class RefTypeNode extends AstNode {

    private static readonly provider = new RefTypeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly target: RefTargetTypeNode,
        /** INV qualifies the referenced object, not this reference variable. */
        public readonly targetInv: SourceValue<string> | undefined = undefined
    ) {
        super(AstKind.RefType);

        this.adopt(target);
    }

    override documentationProvider(): DocumentationProvider<RefTypeNode> {

        return RefTypeNode.provider;
    }

    override lookupSourceValue( position: SourceOffset ): AstLookupResult | undefined {

        const keyword = this.lookupOwnSourceValue(position, this.keyword);

        if (keyword) {
            return keyword;
        }

        return this.lookupOwnSourceValue(position, this.targetInv)
            ?? this.target.lookupSourceValue(position);
    }

    public override dumpLabel(): string {
        return this.targetInv ? "RefType(INV)" : "RefType";
    }

    public override getChildren(): readonly AstNode[] {
        return [
            this.target
        ];
    }

}
