// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

export enum AstKind {

    TranslationUnit,
    CompilerMode,
    Module,
    ModuleParameter,
    ShellCommand,

    SystemPart,
    AlphicDationSystemDeclaration,
    BasicDationSystemDeclaration,
    InterruptSystemDeclaration,
    
    ProblemPart,

    OneIdentifierOrList,
    ConstantFixedExpression,
    ConstantFixedTerm,
    ConstantFixedFactor,
    ClockConstant,
    DurationConstant,
    SignedConstantExpression,
    DimensionBoundaries,
    DimensionAttribute,
    VirtualDimensionList,

    SimpleType,
    NamedType,

    ProblemDataAttribute,
    GlobalAttribute,
    InitializationAttribute,
    InitElement,

    TypeDeclaration,
    DclDeclaration,
    DclDeclarationSentence,
    SemaAttribute,
    BoltAttribute,
    SpcDeclaration,
    SpcDeclarationSentence,
    SpcProblemDataAttribute,
    SpcSemaAttribute,
    SpcBoltAttribute,
    SpcDationAttribute,
    SpcInterruptAttribute,
    ProcedureDeclaration,
    FormalParameter,
    ProcedureParameterType,
    TaskDeclaration,

    StructType,
    StructComponent,
    RefType,
    TaskReferenceTarget,
    SpcTaskAttribute,
    ProcedureSpecificationParameter,
    ProcedureSignature,
    ProcedureReferenceTarget,
    SpcProcedureAttribute,

    Block,
    Repetition,
    RepetitionForClause,
    RepetitionExpressionClause,
    IfStatement,
    CaseStatement,
    CaseAlternative,
    CaseOut,
    ReturnStatement,
    CallStatement,

    Assignment,
    Operator,
    Literal,

    Identifier
}
