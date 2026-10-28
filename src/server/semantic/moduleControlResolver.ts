// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { CompilerModeNode } from '../ast/module/compilerModeNode';
import type { ModuleNode } from '../ast/module/moduleNode';
import type { ProcessorSettingNode } from '../ast/module/processorSettingNode';
import type { ModuleSizeSettingNode } from '../ast/module/moduleSizeSettingNode';
import type { SetLineSettingNode } from '../ast/module/setLineSettingNode';
import type { MaxErrorSettingNode } from '../ast/module/maxErrorSettingNode';
import type { SourceValue } from '../core/sourceValue';
import { createModuleConfiguration, isKnownCompilerMode } from './moduleConfiguration';
import type {
    ModuleConfiguration, ModuleSizeConfiguration, ProcessorConfiguration,
    SetLineConfiguration
} from './moduleConfiguration';
import {
    SemanticDiagnosticCode as Code,
    SemanticDiagnosticSeverity as Severity
} from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';

type SettingNode = CompilerModeNode | ProcessorSettingNode | ModuleSizeSettingNode
    | SetLineSettingNode | MaxErrorSettingNode;

export interface ResolvedModuleControls {
    readonly configurations: ReadonlyMap<ModuleNode, ModuleConfiguration>;
    readonly diagnostics: readonly SemanticDiagnostic[];
}

/**
 * Resolve module-global settings after parsing. No code generation takes place.
 * The AST keeps the literal spelling; only this phase interprets hex values,
 * processor names and FPU register limits.
 */
export function resolveModuleControls(root: AstNode): ResolvedModuleControls {
    const configurations = new Map<ModuleNode, ModuleConfiguration>();
    const diagnostics: SemanticDiagnostic[] = [];

    function report(
        source: SourceValue<string> | undefined,
        code: Code,
        message: string,
        severity: Severity = Severity.Error
    ): void {
        if (!source?.location) return; // Parser already reported a missing token.
        diagnostics.push({ code, severity, location: source.location, message });
    }

    function decimal(source: SourceValue<string>, name: string): number | undefined {
        if (!/^\d+$/.test(source.value)) return undefined; // Recovery placeholder
        const result = Number(source.value);
        if (!Number.isSafeInteger(result)) {
            report(source, Code.InvalidCompilerSettingValue, `${name} ist keine sicher darstellbare ganze Zahl.`);
            return undefined;
        }
        return result;
    }

    function hex(source: SourceValue<string>, name: string): bigint | undefined {
        if (!/^\$?[0-9a-fA-F]+$/.test(source.value)) {
            if (source.location) report(source, Code.InvalidCompilerSettingValue,
                `${name} erfordert eine Hexzahl mit optionalem '$'-Präfix.`);
            return undefined;
        }
        const digits = source.value.startsWith('$') ? source.value.slice(1) : source.value;
        return BigInt('0x' + digits);
    }

    function processorSetting(node: ProcessorSettingNode): ProcessorConfiguration | undefined {
        const name = node.processor.value;
        const options = new Set(['68000', '68020', '68040', '68060', '68881', 'MPC603', 'MPC604', 'MPC405']);
        if (!options.has(name)) {
            report(node.processor, Code.UnknownTargetProcessor, `Unbekannter RTOS-UH-Zielprozessor '${name}'.`);
            return undefined;
        }
        const hasRegisters = node.registerCount !== undefined;
        const explicitFpu = node.plusOperator !== undefined;
        if (node.fpuKeyword && !node.fpuKeyword.location) return undefined;
        const isPowerPcFpu = name === 'MPC603' || name === 'MPC604';
        if (explicitFpu && !isPowerPcFpu) {
            report(node.plusOperator, Code.InvalidProcessorOption,
                'Die Schreibweisen +(n) und +FPU(n) sind nur bei MPC603/MPC604 erlaubt.');
            return undefined;
        }
        if (isPowerPcFpu && hasRegisters !== explicitFpu) {
            report(node.processor, Code.InvalidProcessorOption,
                `P=${name} akzeptiert Registerzahlen nur in der Form +(n) oder +FPU(n).`);
            return undefined;
        }
        if (hasRegisters && !['68040', '68060', '68881', 'MPC603', 'MPC604'].includes(name)) {
            report(node.registerCount, Code.InvalidProcessorOption,
                `P=${name} unterstützt keine Registerzahl.`);
            return undefined;
        }
        if (!hasRegisters) return { name, explicitFpu: false, fpuRegisters: name === '68881' ? 1 : undefined };

        const count = decimal(node.registerCount!, 'FPU-Registerzahl');
        if (count === undefined) return undefined;
        const min = name === '68881' ? 1 : isPowerPcFpu ? 0 : 3;
        const max = isPowerPcFpu ? 32 : 8;
        if (count < min || count > max) {
            report(node.registerCount, Code.InvalidFpuRegisterCount,
                `P=${name} erlaubt FPU-Registerzahlen von ${min} bis ${max}.`);
            return undefined;
        }
        return { name, fpuRegisters: count, explicitFpu };
    }

    function sizeSetting(node: ModuleSizeSettingNode): ModuleSizeConfiguration | undefined {
        const size = hex(node.size, 'Modulgröße');
        if (size === undefined) return undefined;
        const hasRomArguments = node.codeKeyword !== undefined || node.codeAddress !== undefined
            || node.varKeyword !== undefined || node.varAddress !== undefined;
        if (!hasRomArguments) {
            return { size, clearOnLoad: node.keyword.value === 'SC' };
        }
        if (!node.codeKeyword?.location || !node.varKeyword?.location
            || !node.codeAddress || !node.varAddress) {
            // The parser emits the syntax diagnostic; do not accept a partial ROM setting.
            return undefined;
        }
        const codeAddress = hex(node.codeAddress, 'CODE-Adresse');
        const varAddress = hex(node.varAddress, 'VAR-Adresse');
        if (codeAddress === undefined || varAddress === undefined) return undefined;
        return { size, clearOnLoad: node.keyword.value === 'SC', codeAddress, varAddress };
    }

    function setLineSetting(node: SetLineSettingNode): SetLineConfiguration | undefined {
        const firstLine = decimal(node.firstLine, 'SETLINE-Zeilennummer');
        if (firstLine === undefined) return undefined;
        if (firstLine >= 32_000) {
            report(node.firstLine, Code.LineMarkerLimit,
                'RTOS-UH begrenzt Zeilenmarker auf ungefähr 32000.', Severity.Warning);
        }
        if (!node.moduleId) return { firstLine };
        const moduleId = decimal(node.moduleId, 'Modul-ID');
        if (moduleId === undefined) return undefined;
        if (moduleId > 29_999) {
            report(node.moduleId, Code.ReservedModuleId,
                'RTOS-UH reserviert Modul-IDs über 29999 für bestimmte Softwarepakete.', Severity.Warning);
        }
        return { firstLine, moduleId };
    }

    function resolve(module: ModuleNode, pending: readonly SettingNode[]): void {
        const modes: SourceValue<string>[] = [];
        let processor: ProcessorConfiguration | undefined;
        let moduleSize: ModuleSizeConfiguration | undefined;
        let setLine: SetLineConfiguration | undefined;
        let maxErrors: number | undefined;
        const seen = new Set<string>();

        for (const setting of pending) {
            if (setting.kind === AstKind.CompilerMode) {
                const mode = (setting as CompilerModeNode).mode;
                modes.push(mode);
                if (!isKnownCompilerMode(mode.value)) {
                    report(mode, Code.UnknownCompilerMode, `Unbekannter Compiler-MODE '${mode.value}'.`);
                }
                continue;
            }
            const key = setting.kind === AstKind.ModuleSizeSetting ? 'S/SC' : AstKind[setting.kind];
            const source = setting.kind === AstKind.ProcessorSetting
                ? (setting as ProcessorSettingNode).keyword
                : setting.kind === AstKind.ModuleSizeSetting
                    ? (setting as ModuleSizeSettingNode).keyword
                    : setting.kind === AstKind.SetLineSetting
                        ? (setting as SetLineSettingNode).keyword
                        : (setting as MaxErrorSettingNode).keyword;
            if (seen.has(key)) {
                report(source, Code.DuplicateCompilerSetting,
                    `Die Compilersteueranweisung ${key} wurde für dieses Modul mehrfach angegeben.`,
                    Severity.Warning);
            }
            seen.add(key);
            switch (setting.kind) {
                case AstKind.ProcessorSetting:
                    processor = processorSetting(setting as ProcessorSettingNode) ?? processor;
                    break;
                case AstKind.ModuleSizeSetting: {
                    const sizeNode = setting as ModuleSizeSettingNode;
                    if (sizeNode.keyword.value === 'S') {
                        report(sizeNode.keyword, Code.PreferScModuleSize,
                            'S=... reserviert Modulspeicher, initialisiert ihn aber nicht. '
                            + 'Verwende SC=...;, damit beim Entladen und Neuladen keine '
                            + 'veralteten 17er-Scheiben wieder sichtbar werden und beim '
                            + 'Linken während des Ladens Fehler verursachen.', Severity.Warning);
                    }
                    moduleSize = sizeSetting(sizeNode) ?? moduleSize;
                    break;
                }
                case AstKind.SetLineSetting:
                    setLine = setLineSetting(setting as SetLineSettingNode) ?? setLine;
                    break;
                case AstKind.MaxErrorSetting: {
                    const value = decimal((setting as MaxErrorSettingNode).maximum, 'MAXERR');
                    if (value !== undefined) maxErrors = value;
                    break;
                }
            }
        }

        if (!seen.has(AstKind[AstKind.ProcessorSetting])) {
            report(module.keyword, Code.MissingProcessorSetting,
                'Keine Prozessorsteueranweisung P=...; angegeben. RTOS-UH verwendet ' +
                'eine vom Compiler beziehungsweise Entwicklungsrechner abhängige ' +
                'Voreinstellung. Für einen eindeutig festgelegten Zielprozessor ' +
                'P=...; vor MODULE angeben.', Severity.Warning);
        }

        if (!seen.has('S/SC')) {
            report(module.keyword, Code.MissingScModuleSize,
                'Es ist weder S=...; noch SC=...; angegeben. Verwende SC=...; '
                + 'vor MODULE, damit der Modulspeicher beim Laden initialisiert wird '
                + 'und keine veralteten 17er-Scheiben sichtbar werden.', Severity.Warning);
        }

        const configuration = createModuleConfiguration(modes, { processor, moduleSize, setLine, maxErrors });
        configurations.set(module, configuration);
        if (configuration.debugInformation && !module.debugKeyword) {
            report(module.modendKeyword, Code.MissingModendDebug,
                'MODE=DEBUG erfordert den Modulabschluss MODEND DEBUG;.');
        } else if (!configuration.debugInformation && module.debugKeyword) {
            report(module.debugKeyword, Code.UnexpectedModendDebug,
                'MODEND DEBUG; erfordert MODE=DEBUG; vor MODULE.');
        }
    }

    if (root.kind === AstKind.Module) {
        resolve(root as ModuleNode, []);
    } else if (root.kind === AstKind.TranslationUnit) {
        const pending: SettingNode[] = [];
        for (const child of root.getChildren()) {
            if (child.kind === AstKind.Module) {
                resolve(child as ModuleNode, pending);
                pending.length = 0;
            } else if ([AstKind.CompilerMode, AstKind.ProcessorSetting, AstKind.ModuleSizeSetting,
                AstKind.SetLineSetting, AstKind.MaxErrorSetting].includes(child.kind)) {
                pending.push(child as SettingNode);
            }
        }
        for (const unused of pending) {
            report(unused.keyword, Code.CompilerSettingWithoutModule,
                'Compilersteueranweisungen müssen vor einer MODULE-Anweisung stehen.');
        }
    }
    return { configurations, diagnostics };
}
