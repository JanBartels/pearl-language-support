// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { Source } from "../../../source/source";
import { AstNode } from "../../astNode";
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { IfStatementDocumentationProvider } from
    "../../../documentation/problem/statements/ifStatementDocumentationProvider";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";
import { statementTokenText } from "./statementTokenText";
import { addConditionalBranchFoldingRegion } from "./conditionalBranchFolding";

/** IF/THEN[/ELSE]/FIN is a statement, not a separate declaration scope. */
export class IfStatementNode extends AstNode {

    private static readonly provider = new IfStatementDocumentationProvider();

    constructor(
        public readonly ifKeyword: SourceValue<string>,
        public readonly conditionTokens: readonly SourceValue<string>[],
        public readonly thenKeyword: SourceValue<string> | undefined,
        public readonly thenBody: readonly AstNode[],
        public readonly elseKeyword: SourceValue<string> | undefined,
        public readonly elseBody: readonly AstNode[],
        public readonly finKeyword: SourceValue<string> | undefined
    ) {
        super(AstKind.IfStatement);
        this.adoptAll(thenBody);
        this.adoptAll(elseBody);
    }

    override documentationProvider(): DocumentationProvider<IfStatementNode> {
        return IfStatementNode.provider;
    }

    override getChildren(): readonly AstNode[] {
        return [...this.thenBody, ...this.elseBody];
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const result = child.lookupSourceValue(position);
            if (result) {
                return result;
            }
        }

        const values = [this.ifKeyword, ...this.conditionTokens, this.thenKeyword,
            this.elseKeyword, this.finKeyword];
        for (const value of values) {
            const result = this.lookupOwnSourceValue(position, value);
            if (result) {
                return result;
            }
        }
        return undefined;
    }

    override addFoldingRegionsTo(source: Source, regions: FoldingRegionCollection): void {
        const start = this.ifKeyword.location;
        const end = this.finKeyword?.location;
        if (start && end && start.source === source && end.source === source) {
            const region = createInclusiveFoldingRegion(start, end);
            if (region) {
                regions.add(region);
            }
        }

        addConditionalBranchFoldingRegion(
            source, regions, this.thenKeyword, this.elseKeyword ?? this.finKeyword
        );
        addConditionalBranchFoldingRegion(source, regions, this.elseKeyword, this.finKeyword);
    }

    override dumpLabel(): string {
        return this.elseKeyword ? "IfStatement(ELSE)" : "IfStatement";
    }

    conditionText(): string {
        return statementTokenText(this.conditionTokens);
    }
}
