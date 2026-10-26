// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../../../source/source";
import { SourceValue } from "../../../core/sourceValue";

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import {
    TaskDeclarationDocumentationProvider
} from "../../../documentation/problem/declarations/taskDeclarationDocumentationProvider";

import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";

import { GlobalAttributeNode } from "./globalAttributeNode";
import { ConstantFixedExpressionNode } from "../expressions/constantFixedExpressionNode";

export class TaskDeclarationNode extends AstNode {

    private static readonly provider =
        new TaskDeclarationDocumentationProvider();

    constructor(
        public readonly name: SourceValue<string>,
        public readonly taskKeyword: SourceValue<string>,
        public readonly priorityKeyword: SourceValue<string> | undefined,
        public readonly priority: ConstantFixedExpressionNode | undefined,
        public readonly residentKeyword: SourceValue<string> | undefined,
        public readonly mainKeyword: SourceValue<string> | undefined,
        public readonly global: GlobalAttributeNode | undefined,
        public readonly body: readonly AstNode[],
        public readonly endKeyword: SourceValue<string> | undefined
    ) {
        super(AstKind.TaskDeclaration);

        if (priority) {
            this.adopt(priority);
        }

        if (global) {
            this.adopt(global);
        }

        this.adoptAll(body);
    }

    override documentationProvider():
        DocumentationProvider<TaskDeclarationNode> {

        return TaskDeclarationNode.provider;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        const priority = this.priority?.lookupSourceValue(position);
        if (priority) {
            return priority;
        }

        const global = this.global?.lookupSourceValue(position);
        if (global) {
            return global;
        }

        for (const child of this.body) {
            const result = child.lookupSourceValue(position);
            if (result) {
                return result;
            }
        }

        return this.lookupOwnSourceValue(position, this.name)
            ?? this.lookupOwnSourceValue(position, this.taskKeyword)
            ?? this.lookupOwnSourceValue(position, this.priorityKeyword)
            ?? this.lookupOwnSourceValue(position, this.residentKeyword)
            ?? this.lookupOwnSourceValue(position, this.mainKeyword)
            ?? this.lookupOwnSourceValue(position, this.endKeyword);
    }

    override addFoldingRegionsTo(
        source: Source,
        regions: FoldingRegionCollection
    ): void {
        if (!this.name.location || !this.endKeyword?.location) {
            return;
        }

        if (this.name.location.source !== source || this.endKeyword.location.source !== source) {
            return;
        }

        const region = createInclusiveFoldingRegion(
            this.name.location,
            this.endKeyword.location
        );

        if (region) {
            regions.add(region);
        }
    }

    public override dumpLabel(): string {
        return this.priority
            ? `TaskDeclaration(${this.name.value}, priority)`
            : `TaskDeclaration(${this.name.value})`;
    }

    public override getChildren(): readonly AstNode[] {
        const children: AstNode[] = [];

        if (this.priority) {
            children.push(this.priority);
        }

        if (this.global) {
            children.push(this.global);
        }

        children.push(...this.body);
        return children;
    }
}
