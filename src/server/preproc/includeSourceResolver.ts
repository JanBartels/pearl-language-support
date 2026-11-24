// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * Compiler-facing, synchronous access to physical #include sources.
 *
 * The preprocessor has already evaluated conditionals and expanded macros in
 * include paths before invoking this interface. A repeated lookup must not
 * imply a new translation unit; each execution remains a separate occurrence.
 *
 * Implementations may read live editor/disk documents (the current local
 * DocumentRegistry) or replay a previously captured, closed source snapshot.
 * Neither the preprocessor nor this contract owns LSP analysis state.
 */
export interface IncludeSourceDocument {
    readonly uri: string;
    getText(): string;
}

export interface IncludeSourceResolver {
    resolveInclude(includingUri: string, includePath: string): IncludeSourceDocument | null;

    /**
     * Target URI even when the file is missing, for dependency watching.
     * Optional for existing test resolvers that only implement resolveInclude.
     */
    resolveIncludeUri?(includingUri: string, includePath: string): string;
}
