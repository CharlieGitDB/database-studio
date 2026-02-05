import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { ConnectionConfig, DatabaseType, MetadataFolderType, ColumnInfo, ConstraintInfo, IndexInfo, RuleInfo, TriggerInfo } from './types';
import { DatabaseManager } from './databaseManager';

export class DatabaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'schema' | 'database' | 'table' | 'collection' | 'key'
            | 'metadataFolder' | 'column' | 'constraint' | 'index' | 'rule' | 'trigger',
        public readonly connectionId?: string,
        public readonly schemaName?: string,
        public readonly databaseName?: string,
        public readonly tableName?: string,
        public readonly isConnected: boolean = false,
        public readonly folderType?: MetadataFolderType,
        public readonly metadata?: any
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
        } else if (itemType === 'metadataFolder') {
            const folderIcons: Record<MetadataFolderType, string> = {
                columns: 'symbol-field',
                constraints: 'lock',
                indexes: 'list-tree',
                rules: 'law',
                triggers: 'zap'
            };
            this.iconPath = new vscode.ThemeIcon(folderType ? folderIcons[folderType] : 'folder');
        } else if (itemType === 'column') {
            this.iconPath = new vscode.ThemeIcon('symbol-field');
        } else if (itemType === 'constraint') {
            const constraintType = metadata?.type as string;
            if (constraintType === 'PRIMARY KEY') {
                this.iconPath = new vscode.ThemeIcon('key');
            } else if (constraintType === 'FOREIGN KEY') {
                this.iconPath = new vscode.ThemeIcon('references');
            } else if (constraintType === 'UNIQUE') {
                this.iconPath = new vscode.ThemeIcon('shield');
            } else if (constraintType === 'CHECK') {
                this.iconPath = new vscode.ThemeIcon('check');
            } else {
                this.iconPath = new vscode.ThemeIcon('lock');
            }
        } else if (itemType === 'index') {
            this.iconPath = new vscode.ThemeIcon('list-tree');
        } else if (itemType === 'rule') {
            this.iconPath = new vscode.ThemeIcon('law');
        } else if (itemType === 'trigger') {
            this.iconPath = new vscode.ThemeIcon('zap');
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
                            vscode.TreeItemCollapsibleState.Collapsed,
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
                        vscode.TreeItemCollapsibleState.Collapsed,
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

        // Handle table expansion - show metadata folders
        if (element.itemType === 'table' && element.connectionId && element.tableName) {
            const config = this.connectionManager.getConnection(element.connectionId);
            if (config?.type === 'postgresql' || config?.type === 'mysql') {
                return this.getMetadataFolders(element, config.type);
            }
        }

        // Handle metadata folder expansion - show items
        if (element.itemType === 'metadataFolder' && element.folderType) {
            return this.getMetadataItems(element);
        }

        return [];
    }

    private getMetadataFolders(element: DatabaseTreeItem, dbType: 'postgresql' | 'mysql'): DatabaseTreeItem[] {
        const folders: { type: MetadataFolderType; label: string }[] = [
            { type: 'columns', label: 'Columns' },
            { type: 'constraints', label: 'Constraints' },
            { type: 'indexes', label: 'Indexes' },
        ];

        // Rules are PostgreSQL-only
        if (dbType === 'postgresql') {
            folders.push({ type: 'rules', label: 'Rules' });
        }

        folders.push({ type: 'triggers', label: 'Triggers' });

        return folders.map(folder =>
            new DatabaseTreeItem(
                folder.label,
                vscode.TreeItemCollapsibleState.Collapsed,
                'metadataFolder',
                element.connectionId,
                element.schemaName,
                element.databaseName,
                element.tableName,
                false,
                folder.type
            )
        );
    }

    private async getMetadataItems(element: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
        if (!element.connectionId || !element.tableName || !element.folderType) {
            return [];
        }

        const config = this.connectionManager.getConnection(element.connectionId);
        if (!config) {
            return [];
        }

        const client = this.databaseManager.getClient(element.connectionId);
        if (!client) {
            return [];
        }

        try {
            switch (element.folderType) {
                case 'columns':
                    return this.getColumnItems(client, element, config.type);
                case 'constraints':
                    return this.getConstraintItems(client, element, config.type);
                case 'indexes':
                    return this.getIndexItems(client, element, config.type);
                case 'rules':
                    if (config.type === 'postgresql') {
                        return this.getRuleItems(client, element);
                    }
                    return [];
                case 'triggers':
                    return this.getTriggerItems(client, element, config.type);
                default:
                    return [];
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load ${element.folderType}: ${error}`);
            return [];
        }
    }

    private async getColumnItems(client: any, element: DatabaseTreeItem, dbType: DatabaseType): Promise<DatabaseTreeItem[]> {
        let columns: ColumnInfo[];
        if (dbType === 'postgresql') {
            columns = await client.getColumns(element.tableName, element.schemaName || 'public');
        } else {
            columns = await client.getColumns(element.tableName);
        }

        return columns.map(col => {
            const badges: string[] = [];
            if (col.isPrimaryKey) { badges.push('PK'); }
            if (col.isForeignKey) { badges.push(`FK → ${col.referencedTable}.${col.referencedColumn}`); }
            if (!col.nullable) { badges.push('NOT NULL'); }

            const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
            const label = `${col.name}: ${col.type}${badgeStr}`;

            return new DatabaseTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                'column',
                element.connectionId,
                element.schemaName,
                element.databaseName,
                element.tableName,
                false,
                undefined,
                col
            );
        });
    }

    private async getConstraintItems(client: any, element: DatabaseTreeItem, dbType: DatabaseType): Promise<DatabaseTreeItem[]> {
        let constraints: ConstraintInfo[];
        if (dbType === 'postgresql') {
            constraints = await client.getConstraints(element.tableName, element.schemaName || 'public');
        } else {
            constraints = await client.getConstraints(element.tableName);
        }

        return constraints.map(constraint => {
            let description = `(${constraint.type})`;
            if (constraint.type === 'FOREIGN KEY' && constraint.referencedTable) {
                description = `(FK → ${constraint.referencedTable})`;
            }

            const item = new DatabaseTreeItem(
                `${constraint.name} ${description}`,
                vscode.TreeItemCollapsibleState.None,
                'constraint',
                element.connectionId,
                element.schemaName,
                element.databaseName,
                element.tableName,
                false,
                undefined,
                constraint
            );

            return item;
        });
    }

    private async getIndexItems(client: any, element: DatabaseTreeItem, dbType: DatabaseType): Promise<DatabaseTreeItem[]> {
        let indexes: IndexInfo[];
        if (dbType === 'postgresql') {
            indexes = await client.getIndexes(element.tableName, element.schemaName || 'public');
        } else {
            indexes = await client.getIndexes(element.tableName);
        }

        return indexes.map(index => {
            const props: string[] = [];
            if (index.type) { props.push(index.type); }
            if (index.isUnique) { props.push('unique'); }
            if (index.isPrimary) { props.push('primary'); }

            const propsStr = props.length > 0 ? ` (${props.join(', ')})` : '';
            const label = `${index.name}${propsStr}`;

            return new DatabaseTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                'index',
                element.connectionId,
                element.schemaName,
                element.databaseName,
                element.tableName,
                false,
                undefined,
                index
            );
        });
    }

    private async getRuleItems(client: any, element: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
        const rules: RuleInfo[] = await client.getRules(element.tableName, element.schemaName || 'public');

        return rules.map(rule => {
            const label = `${rule.name} (${rule.event})`;

            return new DatabaseTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                'rule',
                element.connectionId,
                element.schemaName,
                element.databaseName,
                element.tableName,
                false,
                undefined,
                rule
            );
        });
    }

    private async getTriggerItems(client: any, element: DatabaseTreeItem, dbType: DatabaseType): Promise<DatabaseTreeItem[]> {
        let triggers: TriggerInfo[];
        if (dbType === 'postgresql') {
            triggers = await client.getTriggers(element.tableName, element.schemaName || 'public');
        } else {
            triggers = await client.getTriggers(element.tableName);
        }

        return triggers.map(trigger => {
            const label = `${trigger.name} (${trigger.timing} ${trigger.event})`;

            return new DatabaseTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                'trigger',
                element.connectionId,
                element.schemaName,
                element.databaseName,
                element.tableName,
                false,
                undefined,
                trigger
            );
        });
    }
}
