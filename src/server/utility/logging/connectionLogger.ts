// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Connection } from 'vscode-languageserver/node';
import { Logger } from './logger';

export class ConnectionLogger implements Logger {

  constructor(private connection: Connection) {}

  info(message: string): void {
    this.connection.console.log(message);
  }

  warn(message: string): void {
    this.connection.console.warn(message);
  }

  error(message: string): void {
    this.connection.console.error(message);
  }

  debug(message: string): void {
    this.connection.console.log(`[DEBUG] ${message}`);
  }
}
