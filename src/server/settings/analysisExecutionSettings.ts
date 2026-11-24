// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * Process-wide analysis capacity, fixed for the lifetime of one LSP server.
 * A value of zero selects the existing synchronous/local executor.
 * The VS Code client supplies the window-scoped setting at initialization.
 */
export interface AnalysisExecutionSettings {
  readonly workerCount: number;
  readonly source: 'settings' | 'environment';
}

interface AnalysisEnvironment {
  readonly PEARL_ANALYSIS_EXECUTOR?: string | undefined;
  readonly PEARL_ANALYSIS_WORKERS?: string | undefined;
}

function validWorkerCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && value <= 16;
}

/**
 * Legacy F5 benchmark variables intentionally override the regular setting.
 * Other LSP clients without initializationOptions retain the local default.
 */
export function resolveAnalysisExecutionSettings(
  initializationOptions: unknown,
  environment: AnalysisEnvironment = {
    PEARL_ANALYSIS_EXECUTOR: process.env.PEARL_ANALYSIS_EXECUTOR,
    PEARL_ANALYSIS_WORKERS: process.env.PEARL_ANALYSIS_WORKERS
  }
): AnalysisExecutionSettings {
  if (environment.PEARL_ANALYSIS_EXECUTOR !== undefined) {
    if (environment.PEARL_ANALYSIS_EXECUTOR === 'local') {
      return { workerCount: 0, source: 'environment' };
    }
    if (environment.PEARL_ANALYSIS_EXECUTOR !== 'worker') {
      throw new Error('PEARL_ANALYSIS_EXECUTOR must be local or worker');
    }
    const raw = environment.PEARL_ANALYSIS_WORKERS;
    const count = raw === undefined ? 1 : Number(raw);
    if (!validWorkerCount(count) || count === 0) {
      throw new Error('PEARL_ANALYSIS_WORKERS must be an integer between 1 and 16');
    }
    return { workerCount: count, source: 'environment' };
  }

  // The shape belongs to the client/server initialization contract, not to
  // per-document PearlSettings (whose resource scope is intentionally separate).
  const options = initializationOptions as
    { analysis?: { workerCount?: unknown } } | null | undefined;
  const count = options?.analysis?.workerCount;
  if (count === undefined) return { workerCount: 0, source: 'settings' };
  if (!validWorkerCount(count)) {
    throw new Error('pearl.analysis.workerCount must be an integer between 0 and 16');
  }
  return { workerCount: count, source: 'settings' };
}
