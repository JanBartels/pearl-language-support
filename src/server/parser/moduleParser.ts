// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from './parserBase';
import { ModuleNode } from '../ast/moduleNode';
import { SystemPartParser } from './systemPartParser';
import { ProblemPartParser } from './problemPartParser';

export class ModuleParser extends ParserBase {

    parse(): ModuleNode | undefined {

        this.skipTrivia();
        if (!this.acceptKeyword("MODULE")) {
            return undefined;
        }

        const start = this.location();

        this.skipTrivia();
        const identifier = this.expectIdentifier();
        const name = identifier
            ? this.tokenText(identifier)
            : "<error>";

        this.skipTrivia();
        if (!identifier) {
            this.synchronize([";"]);
        }

        this.expectOperator(";");

        const module = new ModuleNode(
            start,
            name
        );

        this.synchronize([
            "SYSTEM",
            "PROBLEM",
            "MODEND"
        ]);
        const system = new SystemPartParser(this.context).parse();
        if (system) {
            module.systemPart = system;
            module.adopt(system);
        }

        const problem = new ProblemPartParser(this.context).parse();
        if (problem) {
            module.problemPart = problem;
            module.adopt(problem);
        }

        this.skipTrivia();
        const modend = this.expectKeyword("MODEND");

        this.skipTrivia();
        const debug = this.acceptIdentifier();
        if (debug && this.tokenText(debug) !== "DEBUG") {
            this.problems.error(
                this.location(debug),
                "Expected 'DEBUG' or ';' after MODEND."
            );
        }

        if (!modend) {
            return module;  // Kein sinnvoller Sync-Point mehr.
        }

        this.skipTrivia();
        this.expectOperator(";");
        this.skipTrivia();

        return module;
    }

}
