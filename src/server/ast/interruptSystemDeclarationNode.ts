// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { SourceValue } from '../core/sourceValue';
import { AstLookupResult } from './astLookupResult';

import { SystemDeclarationNode } from './systemDeclarationNode';
import { DocumentationProvider } from '../documentation/documentationProvider';
import { InterruptDocumentationProvider } from '../documentation/interruptDocumentationProvider';

export class InterruptSystemDeclarationNode extends SystemDeclarationNode {

    private static readonly provider = new InterruptDocumentationProvider();
    
    constructor(public readonly keyword: SourceValue<string>, name: SourceValue<string>, public readonly mask: SourceValue<string>) {
        super(
            AstKind.InterruptSystemDeclaration,
            name
        );
        this.keyword = keyword;
    }
    
    override documentationProvider():
            DocumentationProvider<InterruptSystemDeclarationNode> {

            return InterruptSystemDeclarationNode.provider;
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

        result = this.lookupOwnSourceValue(offset, this.mask);
        if (result) {
            return result;
        }

        return undefined;
    }

    public override dumpLabel(): string {
       return `Interrupt(${this.name.value} mask ${this.mask.value} )`;
    }

}
