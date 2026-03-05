import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConnectionConfig, DatabaseType } from './types';
import { ConnectionManager } from './connectionManager';
import { DatabaseManager } from './databaseManager';

export class ConnectionFormPanel {
    public static currentPanel: ConnectionFormPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly connectionManager: ConnectionManager;
    private readonly databaseManager: DatabaseManager;
    private readonly treeRefreshCallback: () => void;
    private readonly mode: 'add' | 'edit';
    private readonly existingConfig?: ConnectionConfig;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(
        extensionUri: vscode.Uri,
        connectionManager: ConnectionManager,
        databaseManager: DatabaseManager,
        treeRefreshCallback: () => void,
        existingConfig?: ConnectionConfig
    ): void {
        const column = vscode.ViewColumn.Active;
        const mode = existingConfig ? 'edit' : 'add';
        const title = existingConfig
            ? `Edit Connection: ${existingConfig.name}`
            : 'Add Connection';

        // If we already have a panel open, dispose it first
        if (ConnectionFormPanel.currentPanel) {
            ConnectionFormPanel.currentPanel.dispose();
        }

        const panel = vscode.window.createWebviewPanel(
            'connectionForm',
            title,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(extensionUri.fsPath, 'out', 'webviews'))]
            }
        );

        ConnectionFormPanel.currentPanel = new ConnectionFormPanel(
            panel,
            extensionUri,
            connectionManager,
            databaseManager,
            treeRefreshCallback,
            mode,
            existingConfig
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        connectionManager: ConnectionManager,
        databaseManager: DatabaseManager,
        treeRefreshCallback: () => void,
        mode: 'add' | 'edit',
        existingConfig?: ConnectionConfig
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.connectionManager = connectionManager;
        this.databaseManager = databaseManager;
        this.treeRefreshCallback = treeRefreshCallback;
        this.mode = mode;
        this.existingConfig = existingConfig;

        // Set the webview content
        this.panel.webview.html = this.getWebviewContent();

        // Send init message after a short delay (webview needs time to load)
        setTimeout(() => {
            this.panel.webview.postMessage({
                command: 'init',
                mode: this.mode,
                config: this.existingConfig ? {
                    id: this.existingConfig.id,
                    name: this.existingConfig.name,
                    type: this.existingConfig.type,
                    host: this.existingConfig.host,
                    port: this.existingConfig.port,
                    username: this.existingConfig.username,
                    password: this.existingConfig.password,
                    database: this.existingConfig.database,
                    updateProtection: this.existingConfig.updateProtection
                } : undefined
            });
        }, 100);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'save':
                        await this.handleSave(message.data);
                        break;
                    case 'testConnection':
                        await this.handleTestConnection(message.data);
                        break;
                    case 'cancel':
                        this.dispose();
                        break;
                }
            },
            null,
            this.disposables
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => this.dispose(),
            null,
            this.disposables
        );
    }

    private getWebviewContent(): string {
        const htmlPath = path.join(this.extensionUri.fsPath, 'out', 'webviews', 'connectionForm.html');
        const jsPath = path.join(this.extensionUri.fsPath, 'out', 'webviews', 'connectionForm.js');

        let html = fs.readFileSync(htmlPath, 'utf8');
        const jsContent = fs.readFileSync(jsPath, 'utf8');

        // Set CSP
        const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';`;
        html = html.replace(
            /<meta http-equiv="Content-Security-Policy"[^>]*>/,
            `<meta http-equiv="Content-Security-Policy" content="${csp}">`
        );

        // Replace script placeholder with inline script
        html = html.replace(
            '<script src="__SCRIPT_URI__"></script>',
            `<script>${jsContent}</script>`
        );

        return html;
    }

    private async handleSave(data: any): Promise<void> {
        try {
            const config: ConnectionConfig = {
                id: data.id || Date.now().toString(),
                name: data.name,
                type: data.type as DatabaseType,
                host: data.host,
                port: data.port,
                username: data.username,
                password: data.password,
                database: data.database,
                updateProtection: data.updateProtection
            };

            if (this.mode === 'edit') {
                await this.connectionManager.updateConnection(config);
                vscode.window.showInformationMessage(`Connection "${config.name}" updated successfully`);
            } else {
                await this.connectionManager.addConnection(config);
                vscode.window.showInformationMessage(`Connection "${config.name}" added successfully`);
            }

            this.treeRefreshCallback();
            this.dispose();
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'saveResult',
                success: false,
                error: String(error)
            });
        }
    }

    private async handleTestConnection(data: any): Promise<void> {
        const tempConfig: ConnectionConfig = {
            id: '__test_' + Date.now().toString(),
            name: data.name || 'Test',
            type: data.type as DatabaseType,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password,
            database: data.database
        };

        try {
            await this.databaseManager.connect(tempConfig);
            // Connection succeeded — disconnect the temp connection
            await this.databaseManager.disconnect(tempConfig.id);

            this.panel.webview.postMessage({
                command: 'testResult',
                success: true
            });
        } catch (error) {
            // Make sure we clean up even on failure
            try {
                await this.databaseManager.disconnect(tempConfig.id);
            } catch {
                // Ignore cleanup errors
            }

            this.panel.webview.postMessage({
                command: 'testResult',
                success: false,
                error: String(error)
            });
        }
    }

    public dispose(): void {
        ConnectionFormPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
