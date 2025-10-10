import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { ConnectionConfig, DatabaseType } from './types';
import { DatabaseManager } from './databaseManager';

export class DatabaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'schema' | 'database' | 'table' | 'collection' | 'key',
        public readonly connectionId?: string,
        public readonly schemaName?: string,
        public readonly databaseName?: string,
        public readonly tableName?: string,
        public readonly isConnected: boolean = false
    ) {
        super(label, collapsibleState);

        this.contextValue = isConnected ? `${itemType}-connected` : `${itemType}-disconnected`;

        if (itemType === 'connection') {
            this.iconPath = new vscode.ThemeIcon(isConnected ? 'database' : 'debug-disconnect');
        } else if (itemType === 'table' || itemType === 'collection') {
            this.iconPath = new vscode.ThemeIcon('symbol-field');
        } else if (itemType === 'key') {
            this.iconPath = new vscode.ThemeIcon('key');
        } else if (itemType === 'schema') {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (itemType === 'database') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
        }
    }
}

export class DatabaseTreeDataProvider implements vscode.TreeDataProvider<DatabaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseTreeItem | undefined | null | void> =
        new vscode.EventEmitter<DatabaseTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private connectedDatabases: Set<string> = new Set();

    constructor(
        private connectionManager: ConnectionManager,
        private databaseManager: DatabaseManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setConnectionStatus(connectionId: string, connected: boolean): void {
        if (connected) {
            this.connectedDatabases.add(connectionId);
        } else {
            this.connectedDatabases.delete(connectionId);
        }
        this.refresh();
    }

    isConnected(connectionId: string): boolean {
        return this.connectedDatabases.has(connectionId);
    }

    getTreeItem(element: DatabaseTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
        if (!element) {
            // Root level - show all connections
            const connections = this.connectionManager.getAllConnections();
            return connections.map(conn => {
                const isConnected = this.connectedDatabases.has(conn.id);
                return new DatabaseTreeItem(
                    `${conn.name} (${conn.type})`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'connection',
                    conn.id,
                    undefined,
                    undefined,
                    isConnected
                );
            });
        }

        if (element.itemType === 'connection' && element.connectionId) {
            // Show databases/collections/keys based on connection type
            const config = this.connectionManager.getConnection(element.connectionId);
            if (!config || !this.isConnected(element.connectionId)) {
                return [];
            }

            try {
                const client = this.databaseManager.getClient(element.connectionId);
                if (!client) {
                    return [];
                }

                if (config.type === 'postgresql') {
                    const pgClient = client as any; // PostgresClient
                    const schemas = await pgClient.getSchemas();
                    return schemas.map((schema: string) =>
                        new DatabaseTreeItem(
                            schema,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            'schema',
                            element.connectionId,
                            schema
                        )
                    );
                } else if (config.type === 'mysql') {
                    const mysqlClient = client as any; // MySQLClient
                    const tables = await mysqlClient.getTables();
                    return tables.map((table: string) =>
                        new DatabaseTreeItem(
                            table,
                            vscode.TreeItemCollapsibleState.None,
                            'table',
                            element.connectionId,
                            undefined,
                            undefined,
                            table
                        )
                    );
                } else if (config.type === 'redis') {
                    return [
                        new DatabaseTreeItem(
                            'Keys',
                            vscode.TreeItemCollapsibleState.Collapsed,
                            'database',
                            element.connectionId,
                            undefined,
                            'keys'
                        )
                    ];
                } else if (config.type === 'mongodb') {
                    return [
                        new DatabaseTreeItem(
                            config.database || 'default',
                            vscode.TreeItemCollapsibleState.Collapsed,
                            'database',
                            element.connectionId,
                            undefined,
                            config.database
                        )
                    ];
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load schemas: ${error}`);
                return [];
            }
        }

        if (element.itemType === 'schema' && element.connectionId && element.schemaName) {
            // Show tables in a PostgreSQL schema
            try {
                const client = this.databaseManager.getClient(element.connectionId);
                if (!client) {
                    return [];
                }

                const pgClient = client as any; // PostgresClient
                const tables = await pgClient.getTables(element.schemaName);
                return tables.map((table: string) =>
                    new DatabaseTreeItem(
                        table,
                        vscode.TreeItemCollapsibleState.None,
                        'table',
                        element.connectionId,
                        element.schemaName,
                        undefined,
                        table
                    )
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load tables: ${error}`);
                return [];
            }
        }

        return [];
    }
}
