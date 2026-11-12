// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AnalysisResult } from './analysisResult';
import { Analysis, collectBlockComments } from './analysis';
import { FileSource } from '../source/fileSource';
import { Lexer } from '../lexer/lexer';
import { ArrayTokenStream } from '../lexer/arrayTokenStream';

import { ProblemCollection } from '../core/problemCollection';
import { ProblemTag } from '../core/problemTag';
import { PreprocessorInactiveRegionCollector } from '../preproc/preprocessorInactiveRegionCollector';
import { MacroOccurrenceIndex } from '../preproc/macroOccurrenceIndex';
import { UnusedMacroAnalyzer } from '../preproc/unusedMacroAnalyzer';

import { Preprocessor } from '../preproc/preprocessor';
import { PreprocessorContext } from '../preproc/preprocessorContext';
import { MacroTable } from '../preproc/macroTable';
import { MacroReference } from '../preproc/macroReference';
import { PreprocessorConditionalBlockStack } from '../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preproc/preprocessorConditionalBlockCollection';

import { Parser } from '../parser/parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PearlSettings } from '../settings/pearlSettings';
import { WorkspaceManager } from '../utility/workspace';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Logger } from '../utility/logging/logger';
import { ConditionalStack } from '../preproc/conditionalStack';

import { AstDumper } from '../ast/astDumper';

import { SemanticAnalyzer } from '../semantic/semanticAnalyzer';
import { SymbolReferenceCollector } from '../semantic/symbolReferenceCollector';
import { SymbolReferenceResolver } from '../semantic/symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../semantic/symbolOccurrenceIndex';
import { UnusedSymbolAnalyzer } from '../semantic/unusedSymbolAnalyzer';
import { CompilerControlAnalyzer } from '../semantic/compilerControlAnalyzer';
import {
    SemanticDiagnostic,
    SemanticDiagnosticSeverity
} from '../semantic/semanticDiagnostic';


const DUMP_AST: boolean = true;


export class Validator {

    constructor(
        private workspaceManager: WorkspaceManager,
        private documentRegistry: DocumentRegistry,
        private logger: Logger
    ) {}


    async analyze(
        document: TextDocument,
        settings: PearlSettings
    ): Promise<AnalysisResult> {

        this.logger.debug?.(`Analyzing ${document.uri}`);
        this.logger.debug?.('[pearl] settings = ' + JSON.stringify(settings));

        const problems = new ProblemCollection();
        const macroReferences: MacroReference[] = [];
        const preprocessorConditionalBlocks = new PreprocessorConditionalBlockCollection();

        // ----------------------------
        // vordefinierte Macros anlegen
        // ----------------------------

        const macroTable = new MacroTable();

        for (const [name, value] of Object.entries(settings.macros ?? {})) {
            macroTable.define(
                name,
                value === '' ? null : value
            );
        }

        // ----------------------------
        // Lexer
        // ----------------------------

        const fileSource = FileSource.fromDocument(document);

        const lexer = new Lexer(
            fileSource,
            problems,
            this.logger
        );

        const tokens = lexer.tokenize();

        // ----------------------------
        // Preprocessor + Parser
        // ----------------------------

        const context = new PreprocessorContext(
            this.documentRegistry,
            macroTable,
            new ConditionalStack(),
            new PreprocessorConditionalBlockStack()
        );

        // External preprocessing produces text; the compiler lexer must see the
        // complete result so that macro-generated comment delimiters can pair.
        const expanded = Preprocessor.createExpanded(
            tokens,
            fileSource,
            context,
            problems,
            macroReferences,
            preprocessorConditionalBlocks,
            this.logger
        );

        // The expanded result owns macro navigation metadata. The legacy array
        // passed to createExpanded only serves the old preprocessor code path.
        // Textual expansion emits its references directly into the result builder.
        const effectiveMacroReferences = [...expanded.macroReferences];
        const macroOccurrences = new MacroOccurrenceIndex(
            context.macroDefinitions, effectiveMacroReferences
        );
        for (const definition of new UnusedMacroAnalyzer().analyze(macroOccurrences)) {
            if (!definition.location) continue;
            problems.warning(
                definition.location,
                `Makro '${definition.name}' wird nicht verwendet.`,
                { tags: [ProblemTag.Unnecessary] }
            );
        }

        // Inactive source ranges are editor metadata produced by the preprocessor.
        // No disabled text is parsed or semantically analyzed.
        const inactiveRegions = new PreprocessorInactiveRegionCollector().collect(
            preprocessorConditionalBlocks
        );
        for (const location of inactiveRegions) {
            problems.hint(location, 'Inaktiver Code (Präprozessor).', {
                tags: [ProblemTag.Unnecessary]
            });
        }

        const compilerTokens = new Lexer(
            expanded.source,
            problems,
            this.logger
        ).tokenize();

        const parser = new Parser(
            new ArrayTokenStream(compilerTokens, expanded.source),
            problems,
            this.logger
        );

        const ast = parser.parse();

        if (DUMP_AST) {
            this.logger.debug?.(
                AstDumper.dump(ast)
            );
        }

        // ----------------------------
        // Syntaktische Symbolreferenzen (unabhaengig von der Semantik)
        // ----------------------------

        const symbolReferences = new SymbolReferenceCollector().collect(ast);

        // ----------------------------
        // Semantik
        // ----------------------------

        const semanticAnalyzer = new SemanticAnalyzer();
        // Compiler-side comments share ExpandedSource offsets with the AST.
        // Original comments remain available through Analysis.tokens for editor features.
        const compilerBlockComments = collectBlockComments(compilerTokens);
        let semanticContext = semanticAnalyzer.analyze(ast, compilerBlockComments, {
            warnOnCharTruncation: settings.warnOnCharTruncation !== false
        });

        // Inactive branches are already absent from compilerTokens; macro-generated
        // comments are present and share their Source with parsed AST locations.
        const compilerControls = new CompilerControlAnalyzer().analyzeWithEntryPoints(
            ast,
            compilerBlockComments,
            semanticContext
        );

        semanticContext = semanticContext.withAdditionalDiagnostics(
            compilerControls.diagnostics
        );

        // ----------------------------
        // Symbolbindungen zu den syntaktischen Referenzen zuordnen
        // ----------------------------

        const symbolReferenceResolutions = new SymbolReferenceResolver().resolve(
            symbolReferences, semanticContext
        );

        const symbolOccurrences = new SymbolOccurrenceIndex(
            symbolReferenceResolutions, semanticContext
        );

        // ----------------------------
        // Verwendung der aufgeloesten Symbole (unabhaengiger semantischer Pass)
        // ----------------------------

        const unused = new UnusedSymbolAnalyzer().analyze(
            semanticContext, symbolReferenceResolutions, compilerControls.gProcedures
        );
        semanticContext = semanticContext.withSymbolUsages(unused.usages, unused.diagnostics);

        this.addSemanticDiagnostics(problems, semanticContext.diagnostics);

        // ----------------------------
        // Analysis
        // ----------------------------

        this.logger.debug?.(
            `Analysis finished: ${problems.size()} problems`
        );

        const analysis = new Analysis(
            fileSource,
            tokens,
            ast,
            problems,
            effectiveMacroReferences,
            preprocessorConditionalBlocks,
            semanticContext,
            symbolReferences,
            symbolReferenceResolutions,
            symbolOccurrences,
            context.macroDefinitions,
            macroOccurrences,
            compilerBlockComments
        );

        return AnalysisResult.create(
            analysis,
            [analysis]
        );
    }


    private addSemanticDiagnostics(
        problems: ProblemCollection,
        diagnostics: readonly SemanticDiagnostic[]
    ): void {

        for (const diagnostic of diagnostics) {

            switch (diagnostic.severity) {

                case SemanticDiagnosticSeverity.Error:
                    problems.error(
                        diagnostic.location,
                        diagnostic.message,
                        { tags: diagnostic.tags }
                    );
                    break;

                case SemanticDiagnosticSeverity.Warning:
                    problems.warning(
                        diagnostic.location,
                        diagnostic.message,
                        { tags: diagnostic.tags }
                    );
                    break;
            }
        }
    }


    handleConfigurationChanged(): void {
        this.logger.debug?.('Configuration changed – invalidating include cache');
        this.documentRegistry.invalidateAllIncludes();
    }
}
