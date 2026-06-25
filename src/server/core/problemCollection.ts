// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Problem, ProblemOptions } from '../core/problem';
import { Location } from '../core/location';

export class ProblemCollection {

    private readonly problems: Problem[] = [];

    add(problem: Problem): void {
        this.problems.push(problem);
    }

    addAll(other: ProblemCollection): void {
        for (const problem of other) {
            this.add(problem);
        }
    }

    size(): number {
        return this.problems.length;
    }

    isEmpty(): boolean {
        return this.problems.length === 0;
    }

    [Symbol.iterator](): Iterator<Problem> {
        return this.problems[Symbol.iterator]();
    }  

    some(
        predicate: (problem: Problem) => boolean
    ): boolean {
        return this.problems.some(predicate);
    }
    
    error(
        location: Location,
        message: string,
        options?: ProblemOptions
    ): void {
        this.add(Problem.error(location, message, options));
    }

    warning(
        location: Location,
        message: string,
        options?: ProblemOptions
    ): void {
        this.add(Problem.warning(location, message, options));
    }

    info(
        location: Location,
        message: string,
        options?: ProblemOptions
    ): void {
        this.add(Problem.info(location, message, options));
    }

    hint(
        location: Location,
        message: string,
        options?: ProblemOptions
    ): void {
        this.add(Problem.hint(location, message, options));
    }

    toArray(): readonly Problem[] {
        return this.problems;
    }
}
