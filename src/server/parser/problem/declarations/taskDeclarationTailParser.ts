// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TaskDeclarationNode } from "../../../ast/problem/declarations/taskDeclarationNode";
import { ConstantFixedExpressionNode } from "../../../ast/problem/expressions/constantFixedExpressionNode";
import { SourceValue } from "../../../core/sourceValue";

import { TailParser } from "../../tailParser";

import { GlobalAttributeParser } from "./globalAttributeParser";
import { ConstantFixedExpressionParser } from "../expressions/constantFixedExpressionParser";
import { BodyParser } from "../statements/bodyParser";

export class TaskDeclarationTailParser extends TailParser {

    parseTail(name: SourceValue<string>): TaskDeclarationNode {
        const taskToken = this.expectKeyword(
            "TASK",
            "Expected 'TASK' after task name."
        );

        if (!taskToken) {
            throw new Error("TaskDeclarationTailParser called without TASK token.");
        }

        this.skipTrivia();

        const priorityKeywordToken = this.acceptKeyword([
            "PRIORITY",
            "PRIO"
        ]);

        let priority: ConstantFixedExpressionNode | undefined;

        if (priorityKeywordToken) {
            this.skipTrivia();
            const checkpoint = this.problemCheckpoint();

            priority = new ConstantFixedExpressionParser(
                this.context
            ).parse();

            if (!priority && !this.hasProblemsSince(checkpoint)) {
                this.problems.error(
                    this.location(),
                    `Expected constant FIXED expression after '${this.tokenText(priorityKeywordToken)}'.`
                );
            }

            this.skipTrivia();
        }

        const residentToken = this.acceptKeyword("RESIDENT");
        this.skipTrivia();

        const mainToken = this.acceptKeyword("MAIN");
        this.skipTrivia();

        const global = new GlobalAttributeParser(this.context).parse();

        if (!this.expectSemicolon("Expected ';' after TASK declaration.")) {
            this.synchronizeTaskHeader();
            this.acceptSemicolon();
        }

        const body = new BodyParser(this.context).parseBody();

        this.skipTrivia();

        const endToken = this.acceptKeyword("END");
        if (!endToken) {
            this.problems.error(
                this.location(),
                "Expected 'END' after TASK body."
            );
        } else {
            this.expectSemicolon("Expected ';' after TASK END.");
        }

        return new TaskDeclarationNode(
            name,
            this.tokenValue(taskToken),
            priorityKeywordToken
                ? this.tokenValue(priorityKeywordToken)
                : undefined,
            priority,
            residentToken
                ? this.tokenValue(residentToken)
                : undefined,
            mainToken
                ? this.tokenValue(mainToken)
                : undefined,
            global,
            body,
            endToken
                ? this.tokenValue(endToken)
                : undefined
        );
    }

    private synchronizeTaskHeader(): void {
        this.synchronize([
            ";",
            "TYPE",
            "DCL",
            "DECLARE",
            "SPC",
            "SPECIFY",
            "BEGIN",
            "FOR",
            "REPEAT",
            "END",
            "MODEND"
        ]);
    }
}
