// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from '../../../source/source';
import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { ProcedureDeclarationDocumentationProvider } from '../../../documentation/problem/declarations/procedureDeclarationDocumentationProvider';
import { FoldingRegionCollection } from '../../../folding/foldingRegionCollection';
import { createInclusiveFoldingRegion } from '../../../folding/foldingRegion';
import { GlobalAttributeNode } from './globalAttributeNode';
import { ProblemDataTypeNode } from '../types/problemDataTypeNode';
import { FormalParameterNode } from './formalParameterNode';

/** The procedure header, formal parameters and body remain separate AST productions. */
export class ProcedureDeclarationNode extends AstNode {
    private static readonly provider = new ProcedureDeclarationDocumentationProvider();

    constructor(
        public readonly name: SourceValue<string>,
        public readonly procKeyword: SourceValue<string>,
        public readonly parameters: readonly FormalParameterNode[],
        public readonly returnsKeyword: SourceValue<string> | undefined,
        public readonly resultType: ProblemDataTypeNode | undefined,
        public readonly global: GlobalAttributeNode | undefined,
        public readonly body: readonly AstNode[],
        public readonly endKeyword: SourceValue<string> | undefined,
        public readonly parameterListOpen: SourceValue<string> | undefined,
        public readonly headerSemicolon: SourceValue<string> | undefined,
        public readonly xhelpOpen?: SourceValue<string>,
        public readonly xhelpText?: SourceValue<string>
    ) {
        super(AstKind.ProcedureDeclaration);
        this.adoptAll(parameters);
        if (resultType) this.adopt(resultType);
        if (global) this.adopt(global);
        this.adoptAll(body);
    }

    override documentationProvider(): DocumentationProvider<ProcedureDeclarationNode> {
        return ProcedureDeclarationNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const found = child.lookupSourceValue(position);
            if (found) return found;
        }
        return this.lookupOwnSourceValue(position, this.name)
            ?? this.lookupOwnSourceValue(position, this.procKeyword)
            ?? this.lookupOwnSourceValue(position, this.returnsKeyword)
            ?? this.lookupOwnSourceValue(position, this.endKeyword)
            ?? this.lookupOwnSourceValue(position, this.xhelpOpen)
            ?? this.lookupOwnSourceValue(position, this.xhelpText)
            ?? this.lookupOwnSourceValue(position, this.parameterListOpen)
            ?? this.lookupOwnSourceValue(position, this.headerSemicolon);
    }

    override addFoldingRegionsTo(source: Source, regions: FoldingRegionCollection): void {
        const start = this.name.location;
        const end = this.endKeyword?.location;
        if (!start || !end || start.source !== source || end.source !== source) return;
        const region = createInclusiveFoldingRegion(start, end);
        if (region) regions.add(region);
    }

    /** First grammatical token after PROC/PROCEDURE, excluding lexer trivia. */
    firstHeaderTokenAfterProc(): SourceValue<string> | undefined {
        return this.xhelpOpen
            ?? this.parameterListOpen
            ?? this.returnsKeyword
            ?? this.global?.keyword
            ?? this.headerSemicolon;
    }

    override dumpLabel(): string {
        return `ProcedureDeclaration(${this.name.value}, ${this.parameters.length} parameter groups${
            this.returnsKeyword ? ', RETURNS' : ''})`;
    }

    override getChildren(): readonly AstNode[] {
        return [
            ...this.parameters,
            ...(this.resultType ? [this.resultType] : []),
            ...(this.global ? [this.global] : []),
            ...this.body
        ];
    }
}
