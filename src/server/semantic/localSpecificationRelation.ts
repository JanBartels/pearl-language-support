// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';

/** An SPC paired with a PROC/TASK definition in the same module (with or without GLOBAL). */
export interface LocalSpecificationRelation {
    readonly kind: 'PROC' | 'TASK';
    readonly specification: SourceValue<string>;
    readonly definition: SourceValue<string>;
}

/** Both SourceValue identities address the same relation, even on errors. */
export type LocalSpecificationRelationIndex = ReadonlyMap<
    SourceValue<string>, LocalSpecificationRelation
>;

export function lookupLocalSpecificationRelation(
    relations: LocalSpecificationRelationIndex,
    source: SourceValue<unknown>
): LocalSpecificationRelation | undefined {
    if (typeof source.value !== 'string') {
        return undefined;
    }

    return relations.get(source as SourceValue<string>);
}
