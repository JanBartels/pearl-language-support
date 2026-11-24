// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * Keeps the LSP configuration notification and a process-wide executor
 * restart in a single order. Configuration notifications are owned by the
 * language client's didChangeConfiguration feature; this coordinator only
 * sequences its `next` call with an eventual restart.
 *
 * The server's executor is created during initialize, so the last value
 * passed through initializationOptions is the authoritative applied value.
 */
export class AnalysisWorkerConfigurationCoordinator {
  private initializedWorkerCount: number | undefined;
  private notifications: Promise<void> = Promise.resolve();

  constructor(
    private readonly configuredWorkerCount: () => number,
    private readonly restart: () => Promise<void>
  ) {}

  noteInitialization(workerCount: number): void {
    this.initializedWorkerCount = workerCount;
  }

  /** Forward the notification *before* stopping its receiving process. */
  forwardConfiguration(
    sections: string[] | undefined,
    next: (sections: string[] | undefined) => Promise<void>
  ): Promise<void> {
    const completion = this.notifications.catch(() => undefined).then(async () => {
      await next(sections);
      if (this.initializedWorkerCount !== undefined
          && this.configuredWorkerCount() !== this.initializedWorkerCount) {
        await this.restart();
      }
    });
    this.notifications = completion;
    return completion;
  }
}
