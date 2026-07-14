// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { SourceValue } from '../../../core/sourceValue';
import { AstLookupResult } from '../../astLookupResult';

import { SystemDeclarationNode } from './systemDeclarationNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { BasicDationDocumentationProvider } from '../../../documentation/system/declarations/basicDationDocumentationProvider';

export class BasicDationSystemDeclarationNode extends SystemDeclarationNode {

    private static readonly provider = new BasicDationDocumentationProvider();
    
    constructor(
        public readonly keyword: SourceValue<string>,         
        name: SourceValue<string>,
        public readonly address: SourceValue<string>,
        public readonly accessCode: SourceValue<string> | undefined,
        public readonly direction: SourceValue<string>
    ) {
        super(
            AstKind.BasicDationSystemDeclaration,
            name
        );
        this.keyword = keyword;
    }

    override documentationProvider():
            DocumentationProvider<BasicDationSystemDeclarationNode> {

            return BasicDationSystemDeclarationNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        let result = this.lookupOwnSourceValue(offset, this.keyword);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.name);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.address);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.accessCode);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.direction);
        if (result) {
            return result;
        }

        return undefined;
    }

    public override dumpLabel(): string {
       return `BASIC Dation(${this.name.value} direction ${this.direction.value})`;
    }

}
