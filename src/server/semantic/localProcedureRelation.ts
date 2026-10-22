// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** @deprecated Use localSpecificationRelation for both PROC and TASK. */
export type {
    LocalSpecificationRelation as LocalProcedureRelation,
    LocalSpecificationRelationIndex as LocalProcedureRelationIndex
} from './localSpecificationRelation';

export {
    lookupLocalSpecificationRelation as lookupLocalProcedureRelation
} from './localSpecificationRelation';
