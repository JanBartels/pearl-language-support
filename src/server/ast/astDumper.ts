// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "./astNode";

export class AstDumper {

    static dump(root: AstNode): string {

        const lines: string[] = [];

        this.dumpNode(root, "", lines);

        return lines.join("\n");
    }

    private static dumpNode(
        node: AstNode,
        indent: string,
        lines: string[]
    ): void {

        lines.push(`${indent}${node.dumpLabel()}`);

        for (const child of node.getChildren()) {
            this.dumpNode(child, indent + "  ", lines);
        }
    }
}