// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** Shared test-only pipeline. Production parsers, AST and LSP remain independent. */
import type { AstNode } from '../../ast/astNode';
import { FormatDeclarationNode } from '../../ast/problem/declarations/formatDeclarationNode';
import { FormatItemNode } from '../../ast/problem/statements/formatItemNode';
import { FormattedIoStatementNode } from '../../ast/problem/statements/formattedIoStatementNode';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import { SymbolOccurrenceIndex } from '../../semantic/symbolOccurrenceIndex';
import { SymbolReferenceCollector } from '../../semantic/symbolReferenceCollector';
import { SymbolReferenceResolver } from '../../semantic/symbolReferenceResolver';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
export const formattedIoTestUri = 'file:///formatted-io-regression.P';

export function parseFormattedIoSource(text: string, uri = formattedIoTestUri) {
    const source = new FileSource(uri, text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const nodes: AstNode[] = [];
    const visit = (node: AstNode): void => { nodes.push(node); node.getChildren().forEach(visit); };
    visit(ast);
    return {
        ast, text, uri,
        syntax: problems.toArray().map(problem => problem.message),
        statements: nodes.filter((node): node is FormattedIoStatementNode =>
            node instanceof FormattedIoStatementNode),
        declarations: nodes.filter((node): node is FormatDeclarationNode =>
            node instanceof FormatDeclarationNode),
        formats: nodes.filter((node): node is FormatItemNode =>
            node instanceof FormatItemNode)
    };
}

export function parseFormattedIo(body: string, prelude = '', tail = '') {
    const text = `P=MPC603; SC=2000; MODULE M;
        SYSTEM; Disk:/ED/IO8641;
        PROBLEM; SPC Disk DATION INOUT ALPHIC;
        DCL VarFixed31 FIXED(31), VarBit BIT(8), FixedErr1 FIXED(15),
            Error31 FIXED(31), InvErr INV FIXED(15) INIT(0), BadErr FLOAT,
            VarChar20 CHAR(20), A FIXED, B FLOAT, Array(3) FIXED;
        ${prelude}
        Main: TASK MAIN; ${body} END; ${tail} MODEND;`;
    return parseFormattedIoSource(text);
}

export function analyzeFormattedIoSource(text: string, uri = formattedIoTestUri) {
    const parsed = parseFormattedIoSource(text, uri);
    const semantic = new SemanticAnalyzer().analyze(parsed.ast);
    const references = new SymbolReferenceCollector().collect(parsed.ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    return { ...parsed, semantic, occurrences, diagnostics: semantic.diagnostics };
}

export function analyzeFormattedIo(body: string, prelude = '', tail = '') {
    const parsed = parseFormattedIo(body, prelude, tail);
    const semantic = new SemanticAnalyzer().analyze(parsed.ast);
    const references = new SymbolReferenceCollector().collect(parsed.ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    return { ...parsed, semantic, occurrences, diagnostics: semantic.diagnostics };
}
