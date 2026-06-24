// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  InitializeParams,
  DidChangeConfigurationNotification
} from 'vscode-languageserver/node';
import { Connection } from 'vscode-languageserver/node';
import { PearlSettings, defaultSettings } from './pearlSettings';

export class SettingsManager {

  private hasConfigurationCapability = false;
  private globalSettings: PearlSettings = defaultSettings;
  private documentSettings: Map<string, Promise<PearlSettings>> = new Map();

  constructor(private connection: Connection) {}

  initialize(params: InitializeParams): void {
    const capabilities = params.capabilities;

    this.hasConfigurationCapability = !!(
      capabilities.workspace &&
      capabilities.workspace.configuration
    );
  }

  registerConfigurationListener(): void {
    if (!this.hasConfigurationCapability) return;

    this.connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }

  async getDocumentSettings(resource: string): Promise<PearlSettings> {
    if (!this.hasConfigurationCapability) {
      return this.globalSettings;
    }

    let result = this.documentSettings.get(resource);
    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: resource,
        section: 'pearl'
      });
      this.documentSettings.set(resource, result);
    }

    return result;
  }

  handleConfigurationChange(settings: any): void {
    if (this.hasConfigurationCapability) {
      this.documentSettings.clear();
    } else {
      this.globalSettings =
        (settings.pearl as PearlSettings) ?? defaultSettings;
    }
  }

  clearDocument(resource: string): void {
    this.documentSettings.delete(resource);
  }

  clearAll(): void {
    this.documentSettings.clear();
  }
}
