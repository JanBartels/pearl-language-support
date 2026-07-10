// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export enum AstKind {

    TranslationUnit,
    Module,
    ModuleParameter,
    ShellCommand,

    SystemPart,
    AlphicDationSystemDeclaration,
    BasicDationSystemDeclaration,
    InterruptSystemDeclaration,
    
    ProblemPart,

    TypeDeclaration,
    DclDeclaration,
    SpcDeclaration,
    ProcedureDeclaration,
    TaskDeclaration,

    StructType,
    RefType,

    Block,

    Assignment,
    Operator,
    Literal,

    Identifier
}
