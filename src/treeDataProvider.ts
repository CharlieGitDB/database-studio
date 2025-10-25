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
        console.log(`Setting connection status for ${connectionId}: ${connected}`);
        if (connected) {
            this.connectedDatabases.add(connectionId);
        } else {
            this.connectedDatabases.delete(connectionId);
        }
        console.log('Connected databases:', Array.from(this.connectedDatabases));
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
                    undefined,
                    isConnected
                );
            });
        }

        if (element.itemType === 'connection' && element.connectionId) {
            // Show databases/collections/keys based on connection type
            const config = this.connectionManager.getConnection(element.connectionId);
            if (!config) {
                console.log('Config not found for connection:', element.connectionId);
                return [];
            }

            // If not connected, return empty array - the expansion event handler will connect
            if (!this.isConnected(element.connectionId)) {
                console.log('Connection not marked as connected:', element.connectionId);
                return [];
            }

            try {
                const client = this.databaseManager.getClient(element.connectionId);
                if (!client) {
                    console.log('Client not found for connection:', element.connectionId);
                    return [];
                }

                if (config.type === 'postgresql') {
                    const pgClient = client as any; // PostgresClient
                    console.log('Fetching schemas for PostgreSQL connection:', element.connectionId);
                    const schemas = await pgClient.getSchemas();
                    console.log('Schemas fetched:', schemas);
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
                    const mongoClient = client as any; // MongoDBClient

                    // If no specific database was configured, list all databases
                    if (!config.database) {
                        const databases = await mongoClient.getDatabases();
                        return databases.map((dbName: string) =>
                            new DatabaseTreeItem(
                                dbName,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                'database',
                                element.connectionId,
                                undefined,
                                dbName
                            )
                        );
                    } else {
                        // Show the single configured database
                        return [
                            new DatabaseTreeItem(
                                config.database,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                'database',
                                element.connectionId,
                                undefined,
                                config.database
                            )
                        ];
                    }
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

        if (element.itemType === 'database' && element.connectionId && element.databaseName) {
            // Show keys for Redis or collections for MongoDB
            const config = this.connectionManager.getConnection(element.connectionId);
            if (!config) {
                return [];
            }

            try {
                const client = this.databaseManager.getClient(element.connectionId);
                if (!client) {
                    return [];
                }

                if (config.type === 'redis') {
                    const redisClient = client as any; // RedisClient
                    console.log('Fetching Redis keys for connection:', element.connectionId);
                    const keys = await redisClient.getKeys();
                    console.log('Keys fetched:', keys.length);
                    return keys.map((keyInfo: any) =>
                        new DatabaseTreeItem(
                            `${keyInfo.key} (${keyInfo.type})`,
                            vscode.TreeItemCollapsibleState.None,
                            'key',
                            element.connectionId,
                            undefined,
                            undefined,
                            keyInfo.key
                        )
                    );
                } else if (config.type === 'mongodb') {
                    const mongoClient = client as any; // MongoDBClient
                    // Pass the database name to get collections from that specific database
                    const collections = await mongoClient.getCollections(element.databaseName);
                    return collections.map((collection: string) =>
                        new DatabaseTreeItem(
                            collection,
                            vscode.TreeItemCollapsibleState.None,
                            'collection',
                            element.connectionId,
                            undefined,
                            element.databaseName,
                            collection
                        )
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load items: ${error}`);
                console.error('Error loading database items:', error);
                return [];
            }
        }

        return [];
    }
}
