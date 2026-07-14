// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { ParserBase } from '../parserBase';
import { TailParser } from '../tailParser';
import { ShellCommandNode } from '../../ast/module/shellCommandNode';

export class ShellCommandParser extends ParserBase {

    parse(): ShellCommandNode | undefined {

        this.skipTrivia();

        const procedure = this.acceptIdentifier();
        if (!procedure) {
            return undefined;
        }

        const commandName = new ShellCommandTailParser(this.context).parseTail();
        if (!commandName) {
            return undefined;
        }

        return new ShellCommandNode(
            this.tokenValue(procedure),
            commandName
        );
    }
}

class ShellCommandTailParser extends TailParser {

    parseTail(): SourceValue<string> | undefined {

        this.skipTrivia();

        if (!this.acceptColon()) {
            return undefined;
        }

        this.skipTrivia();

        const stringLiteral = this.expectStringLiteral();

        if (!stringLiteral) {
            this.synchronize([";"]);
        }

        this.expectSemicolon();

        return stringLiteral
            ? this.tokenValue(stringLiteral)
            : SourceValue.synthetic("<error>");
    }
}
