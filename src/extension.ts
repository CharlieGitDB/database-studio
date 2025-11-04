import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { DatabaseManager } from './databaseManager';
import { DatabaseTreeDataProvider } from './treeDataProvider';
import { DataViewerPanel } from './webviewProvider';
import { ConnectionConfig, DatabaseType } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Database Studio by Reswob extension is now active');

    const connectionManager = new ConnectionManager(context);
    const databaseManager = new DatabaseManager();
    const treeDataProvider = new DatabaseTreeDataProvider(connectionManager, databaseManager);

    const treeView = vscode.window.createTreeView('dbClientExplorer', {
        treeDataProvider
    });

    // Auto-connect when expanding a tree item
    treeView.onDidExpandElement(async (event) => {
        const item = event.element;

        // Check if this is a connection item that needs to be connected
        if (item.itemType === 'connection' && item.connectionId && !item.isConnected) {
            try {
                const config = connectionManager.getConnection(item.connectionId);
                if (!config) {
                    vscode.window.showErrorMessage('Connection not found');
                    return;
                }

                // Connect to the database
                await databaseManager.connect(config);
                treeDataProvider.setConnectionStatus(item.connectionId, true);
                vscode.window.showInformationMessage(`Connected to ${config.name}`);

                // The setConnectionStatus call above triggers refresh() which will reload the tree
                // and show the newly connected item with its children
            } catch (error) {
                console.error('Auto-connect error:', error);
                vscode.window.showErrorMessage(`Failed to connect: ${error}`);
                // Refresh to show disconnected state
                treeDataProvider.refresh();
            }
        }
    });

    context.subscriptions.push(treeView);

    // Add connection command
    const addConnectionCommand = vscode.commands.registerCommand('dbClient.addConnection', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Connection name',
            placeHolder: 'My Database'
        });

        if (!name) {
            return;
        }

        const type = await vscode.window.showQuickPick(
            ['redis', 'mysql', 'postgresql', 'mongodb'],
            { placeHolder: 'Select database type' }
        ) as DatabaseType;

        if (!type) {
            return;
        }

        const host = await vscode.window.showInputBox({
            prompt: 'Host',
            value: 'localhost'
        });

        if (!host) {
            return;
        }

        const portStr = await vscode.window.showInputBox({
            prompt: 'Port',
            value: type === 'redis' ? '6379' :
                   type === 'mysql' ? '3306' :
                   type === 'postgresql' ? '5432' : '27017'
        });

        if (!portStr) {
            return;
        }

        const port = parseInt(portStr);

        let username: string | undefined;
        let password: string | undefined;
        let database: string | undefined;

        if (type !== 'redis') {
            username = await vscode.window.showInputBox({
                prompt: 'Username (optional)',
                placeHolder: 'username'
            });

            password = await vscode.window.showInputBox({
                prompt: 'Password (optional)',
                password: true
            });

            database = await vscode.window.showInputBox({
                prompt: type === 'postgresql' ? 'Database name (required)' : 'Database name (optional)',
                placeHolder: 'database'
            });

            if (type === 'postgresql' && !database) {
                vscode.window.showErrorMessage('Database name is required for PostgreSQL connections');
                return;
            }
        } else {
            password = await vscode.window.showInputBox({
                prompt: 'Password (optional)',
                password: true
            });
        }

        // Ask about update protection for SQL databases
        let updateProtection = false;
        if (type === 'mysql' || type === 'postgresql') {
            const enableProtection = await vscode.window.showQuickPick(
                ['No', 'Yes'],
                {
                    placeHolder: 'Enable update protection? (Will prompt before running UPDATE, INSERT, DELETE queries)',
                    ignoreFocusOut: true
                }
            );
            updateProtection = enableProtection === 'Yes';
        }

        const config: ConnectionConfig = {
            id: Date.now().toString(),
            name,
            type,
            host,
            port,
            username,
            password,
            database,
            updateProtection
        };

        await connectionManager.addConnection(config);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Connection "${name}" added successfully`);
    });

    // Refresh connections command
    const refreshCommand = vscode.commands.registerCommand('dbClient.refreshConnections', () => {
        treeDataProvider.refresh();
    });

    // Edit connection command
    const editConnectionCommand = vscode.commands.registerCommand('dbClient.editConnection', async (item) => {
        if (item && item.connectionId) {
            const existingConfig = connectionManager.getConnection(item.connectionId);
            if (!existingConfig) {
                vscode.window.showErrorMessage('Connection not found');
                return;
            }

            // Disconnect if currently connected
            const wasConnected = databaseManager.getClient(item.connectionId) !== undefined;
            if (wasConnected) {
                await databaseManager.disconnect(item.connectionId);
                treeDataProvider.setConnectionStatus(item.connectionId, false);
            }

            const name = await vscode.window.showInputBox({
                prompt: 'Connection name',
                value: existingConfig.name
            });

            if (!name) {
                return;
            }

            const host = await vscode.window.showInputBox({
                prompt: 'Host',
                value: existingConfig.host
            });

            if (!host) {
                return;
            }

            const portStr = await vscode.window.showInputBox({
                prompt: 'Port',
                value: existingConfig.port.toString()
            });

            if (!portStr) {
                return;
            }

            const port = parseInt(portStr);

            let username: string | undefined;
            let password: string | undefined;
            let database: string | undefined;

            if (existingConfig.type !== 'redis') {
                username = await vscode.window.showInputBox({
                    prompt: 'Username (optional)',
                    value: existingConfig.username || ''
                });

                password = await vscode.window.showInputBox({
                    prompt: 'Password (leave empty to keep existing, or enter new)',
                    password: true,
                    placeHolder: existingConfig.password ? '••••••••' : 'No password set'
                });

                // If password is empty, keep the existing one
                if (!password) {
                    password = existingConfig.password;
                }

                database = await vscode.window.showInputBox({
                    prompt: existingConfig.type === 'postgresql' ? 'Database name (required)' : 'Database name (optional)',
                    value: existingConfig.database || ''
                });

                if (existingConfig.type === 'postgresql' && !database) {
                    vscode.window.showErrorMessage('Database name is required for PostgreSQL connections');
                    return;
                }
            } else {
                password = await vscode.window.showInputBox({
                    prompt: 'Password (leave empty to keep existing, or enter new)',
                    password: true,
                    placeHolder: existingConfig.password ? '••••••••' : 'No password set'
                });

                // If password is empty, keep the existing one
                if (!password) {
                    password = existingConfig.password;
                }
            }

            // Ask about update protection for SQL databases
            let updateProtection = existingConfig.updateProtection || false;
            if (existingConfig.type === 'mysql' || existingConfig.type === 'postgresql') {
                const enableProtection = await vscode.window.showQuickPick(
                    ['No', 'Yes'],
                    {
                        placeHolder: 'Enable update protection? (Will prompt before running UPDATE, INSERT, DELETE queries)',
                        ignoreFocusOut: true
                    }
                );
                updateProtection = enableProtection === 'Yes';
            }

            const updatedConfig: ConnectionConfig = {
                id: existingConfig.id,
                name,
                type: existingConfig.type,
                host,
                port,
                username,
                password,
                database,
                updateProtection
            };

            await connectionManager.updateConnection(updatedConfig);
            treeDataProvider.refresh();
            vscode.window.showInformationMessage(`Connection "${name}" updated successfully`);
        }
    });

    // Delete connection command
    const deleteConnectionCommand = vscode.commands.registerCommand('dbClient.deleteConnection', async (item) => {
        if (item && item.connectionId) {
            const confirm = await vscode.window.showWarningMessage(
                `Delete connection "${item.label}"?`,
                'Yes', 'No'
            );

            if (confirm === 'Yes') {
                await databaseManager.disconnect(item.connectionId);
                await connectionManager.deleteConnection(item.connectionId);
                treeDataProvider.refresh();
                vscode.window.showInformationMessage('Connection deleted');
            }
        }
    });

    // Connect command
    const connectCommand = vscode.commands.registerCommand('dbClient.connect', async (item) => {
        if (item && item.connectionId) {
            try {
                const config = connectionManager.getConnection(item.connectionId);
                if (!config) {
                    vscode.window.showErrorMessage('Connection not found');
                    return;
                }

                await databaseManager.connect(config);
                treeDataProvider.setConnectionStatus(item.connectionId, true);

                // Auto-expand the connection to show schemas/tables
                await vscode.commands.executeCommand('dbClientExplorer.focus');

                vscode.window.showInformationMessage(`Connected to ${config.name}`);
            } catch (error) {
                console.error('Connection error:', error);
                vscode.window.showErrorMessage(`Failed to connect: ${error}`);
            }
        }
    });

    // Disconnect command
    const disconnectCommand = vscode.commands.registerCommand('dbClient.disconnect', async (item) => {
        if (item && item.connectionId) {
            try {
                await databaseManager.disconnect(item.connectionId);
                treeDataProvider.setConnectionStatus(item.connectionId, false);
                const config = connectionManager.getConnection(item.connectionId);
                vscode.window.showInformationMessage(`Disconnected from ${config?.name}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
            }
        }
    });

    // View data command
    const viewDataCommand = vscode.commands.registerCommand('dbClient.viewData', async (item) => {
        if (item && item.connectionId) {
            try {
                const config = connectionManager.getConnection(item.connectionId);
                if (!config) {
                    vscode.window.showErrorMessage('Connection not found');
                    return;
                }

                let resource: string;
                let schema: string | undefined;

                if (item.itemType === 'database' && item.databaseName) {
                    // Show tables/collections/keys
                    const client = databaseManager.getClient(item.connectionId);
                    if (!client) {
                        vscode.window.showErrorMessage('Not connected to database');
                        return;
                    }

                    let items: string[] = [];

                    if (config.type === 'mysql') {
                        items = await (client as any).getTables();
                    } else if (config.type === 'postgresql') {
                        items = await (client as any).getTables();
                    } else if (config.type === 'mongodb') {
                        items = await (client as any).getCollections();
                    } else if (config.type === 'redis') {
                        items = await (client as any).getKeys().then((keys: any[]) => keys.map(k => k.key));
                    }

                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select table/collection/key to view'
                    });

                    if (!selected) {
                        return;
                    }

                    resource = selected;
                } else if (item.tableName) {
                    resource = item.tableName;
                    // Capture schema name for PostgreSQL tables or database name for MongoDB collections
                    schema = item.schemaName || item.databaseName;
                } else {
                    vscode.window.showErrorMessage('Invalid selection');
                    return;
                }

                DataViewerPanel.createOrShow(
                    context.extensionUri,
                    databaseManager,
                    connectionManager,
                    item.connectionId,
                    resource,
                    schema
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to view data: ${error}`);
            }
        }
    });

    context.subscriptions.push(
        addConnectionCommand,
        refreshCommand,
        editConnectionCommand,
        deleteConnectionCommand,
        connectCommand,
        disconnectCommand,
        viewDataCommand
    );

    // Cleanup on deactivation
    context.subscriptions.push({
        dispose: () => {
            databaseManager.disconnectAll();
        }
    });
}

export function deactivate() {
    console.log('Database Studio by Reswob extension deactivated');
}
