// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  InitializeParams,
  DidChangeConfigurationNotification
} from 'vscode-languageserver/node';
import { Connection } from 'vscode-languageserver/node';
import { PearlSettings, defaultSettings } from './pearlSettings';
import { normalizeTranslationUnitDiscoveryDepth } from './translationUnitDiscoverySettings';

export class SettingsManager {

  private hasConfigurationCapability = false;
  private globalSettings: PearlSettings = defaultSettings;
  private documentSettings: Map<string, Promise<PearlSettings>> = new Map();
  private folderDiscoveryDepths = new Map<string, Promise<number>>();
  private globalDiscoveryDepth = 0;

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

    // Only PEARL settings can affect our analyses. Other VS Code settings
    // must not invalidate every translation unit.
    this.connection.client.register(
      DidChangeConfigurationNotification.type,
      { section: 'pearl' }
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

  /** Resource-scoped LSP discovery setting, deliberately not part of PearlSettings. */
  getTranslationUnitDiscoveryDepth(folderUri: string): Promise<number> {
    if (!this.hasConfigurationCapability) return Promise.resolve(this.globalDiscoveryDepth);

    let result = this.folderDiscoveryDepths.get(folderUri);
    if (!result) {
      result = (async () => {
        try {
          const value = await this.connection.workspace.getConfiguration({
            scopeUri: folderUri,
            section: 'pearl.translationUnits.discoveryDepth'
          });
          return normalizeTranslationUnitDiscoveryDepth(value);
        } catch (error) {
          this.folderDiscoveryDepths.delete(folderUri);
          throw error;
        }
      })();
      this.folderDiscoveryDepths.set(folderUri, result);
    }
    return result;
  }

  handleConfigurationChange(settings: any): void {
    if (this.hasConfigurationCapability) {
      this.documentSettings.clear();
      this.folderDiscoveryDepths.clear();
    } else {
      this.globalSettings =
        (settings?.pearl as PearlSettings) ?? defaultSettings;
      this.globalDiscoveryDepth = normalizeTranslationUnitDiscoveryDepth(
        settings?.pearl?.translationUnits?.discoveryDepth
      );
    }
  }

  clearDocument(resource: string): void {
    this.documentSettings.delete(resource);
  }

  clearAll(): void {
    this.documentSettings.clear();
    this.folderDiscoveryDepths.clear();
  }
}
