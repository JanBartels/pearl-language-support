// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from './location';
import { Severity } from './severity';

export interface ProblemOptions {
  readonly code?: string;
  readonly tags?: readonly string[];
}

export class Problem {

  readonly location: Location;
  readonly message: string;
  readonly severity: Severity;
  readonly code?: string | undefined;
  readonly tags?: readonly string[] | undefined;

  private constructor(
    location: Location,
    message: string,
    severity: Severity,
    options?: ProblemOptions
  ) {
    this.location = location;
    this.message = message;
    this.severity = severity;
    this.code = options?.code;
    this.tags = options?.tags;
  }

  static create(
    location: Location,
    message: string,
    severity: Severity,
    options?: ProblemOptions
  ): Problem {
    return new Problem(location, message, severity, options);
  }
}
