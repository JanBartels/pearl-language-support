// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';

import { DocumentationProvider } from '../../documentation/documentationProvider';
import { ShellCommandDocumentationProvider } from '../../documentation/module/shellCommandDocumentationProvider';

export class ShellCommandNode extends AstNode {

    private static readonly provider =
        new ShellCommandDocumentationProvider();

    constructor(
        public readonly procedureName: SourceValue<string>,
        public readonly commandName: SourceValue<string>
    ) {
        super(AstKind.ShellCommand);
    }

    override documentationProvider():
        DocumentationProvider<ShellCommandNode> {

        return ShellCommandNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        let result = this.lookupOwnSourceValue(
            offset,
            this.procedureName
        );
        if (result) {
            return result;
        }

        return this.lookupOwnSourceValue(
            offset,
            this.commandName
        );
    }

    override dumpLabel(): string {
        return `ShellCommand(${this.procedureName.value} -> ${this.commandName.value})`;
    }
}
