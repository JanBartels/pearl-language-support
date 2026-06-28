// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// SystemDeclaration
//
// Internal LL(1) grammar:
//
// SystemDeclaration =
//     Identifier SystemDeclarationTail ;
//
// SystemDeclarationTail =
//       ';'
//     | ':' InterruptSystemTail
//     | ':' DationSystemTail ;
// -----------------------------------------------------------------------------

import { ParserBase } from './parserBase';
import { ParserContext } from './parserContext';
import { SystemDeclarationNode } from '../ast/systemDeclarationNode';
import { AlphicDationSystemDeclarationNode } from '../ast/alphicDationSystemDeclationNode';
import { AlphicDationSystemObjectParser } from './alphicDationSystemObjectParser';
import { BasicDationSystemObjectParser } from './basicDationSystemObjectParser';
import { InterruptSystemObjectParser } from './interruptSystemObjectParser';

export class SystemDeclarationParser extends ParserBase {

    private readonly alphicDationParser: AlphicDationSystemObjectParser;
    private readonly basicDationSystemObjectParser: BasicDationSystemObjectParser;
    private readonly interruptParser: InterruptSystemObjectParser;

    constructor(context: ParserContext) {
        super(context);

        this.alphicDationParser = new AlphicDationSystemObjectParser(context);
        this.basicDationSystemObjectParser = new BasicDationSystemObjectParser(context);
        this.interruptParser = new InterruptSystemObjectParser(context);
    }

    parse(): SystemDeclarationNode | undefined {

        const identifier = this.acceptIdentifier();
        if (!identifier) {
            return undefined;
        }
        const name = this.tokenText(identifier);

        this.skipTrivia();
        if (this.acceptOperator(';')) {
            return new AlphicDationSystemDeclarationNode(identifier.location, name, name, '<->', undefined, false, undefined, undefined);
        }        

        if (!this.expectOperator(':')) {
            this.synchronize([';']);
        }

        this.skipTrivia();

        if (this.isKeyword('EV')) {
            return this.interruptParser.parseTail(this.location(identifier), name);
        }

        if (this.isKeyword('BU')) {
            return this.basicDationSystemObjectParser.parseTail(this.location(identifier), name);
        }

        return this.alphicDationParser.parseTail(this.location(identifier), name);
    }
}
