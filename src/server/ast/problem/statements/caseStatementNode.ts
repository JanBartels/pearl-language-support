// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { Source } from "../../../source/source";
import { AstNode } from "../../astNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { CaseStatementDocumentationProvider } from
    "../../../documentation/problem/statements/caseStatementDocumentationProvider";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";
import { CaseAlternativeNode } from "./caseAlternativeNode";
import { CaseOutNode } from "./caseOutNode";
import { statementTokenText } from "./statementTokenText";
import { addConditionalBranchFoldingRegion } from "./conditionalBranchFolding";

/** Neither CASE nor its ALT/OUT branches introduces a new scope. */
export class CaseStatementNode extends AstNode {

    private static readonly provider = new CaseStatementDocumentationProvider();

    constructor(
        public readonly caseKeyword: SourceValue<string>,
        public readonly selectorTokens: readonly SourceValue<string>[],
        public readonly alternatives: readonly CaseAlternativeNode[],
        public readonly outClause: CaseOutNode | undefined,
        public readonly finKeyword: SourceValue<string> | undefined
    ) {
        super(AstKind.CaseStatement);
        this.adoptAll(alternatives);
        if (outClause) {
            this.adopt(outClause);
        }
    }

    override documentationProvider(): DocumentationProvider<CaseStatementNode> {
        return CaseStatementNode.provider;
    }

    override getChildren(): readonly AstNode[] {
        return this.outClause ? [...this.alternatives, this.outClause] : this.alternatives;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const result = child.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }
        for (const value of [this.caseKeyword, ...this.selectorTokens, this.finKeyword]) {
            const result = this.lookupOwnSourceValue(offset, value);
            if (result) {
                return result;
            }
        }
        return undefined;
    }

    override addFoldingRegionsTo(source: Source, regions: FoldingRegionCollection): void {
        const start = this.caseKeyword.location;
        const end = this.finKeyword?.location;
        if (start && end && start.source === source && end.source === source) {
            const region = createInclusiveFoldingRegion(start, end);
            if (region) {
                regions.add(region);
            }
        }

        // A recovered CASE may contain an ALT after OUT. Preserve its AST,
        // but calculate branch folding boundaries in physical source order.
        const branches = this.alternatives.map(alt => alt.altKeyword);
        if (this.outClause) {
            branches.push(this.outClause.outKeyword);
        }
        const localBranches = branches
            .filter(keyword => keyword.location?.source === source)
            .sort((left, right) => left.location!.span.start - right.location!.span.start);

        for (let index = 0; index < localBranches.length; index++) {
            addConditionalBranchFoldingRegion(
                source, regions, localBranches[index],
                localBranches[index + 1] ?? this.finKeyword
            );
        }
    }

    override dumpLabel(): string {
        const variant = this.alternatives[0]?.caseListTokens ? "indexed" : "positional";
        return `CaseStatement(${variant}, ${this.alternatives.length} ALT${this.outClause ? ", OUT" : ""})`;
    }

    selectorText(): string {
        return statementTokenText(this.selectorTokens);
    }
}
