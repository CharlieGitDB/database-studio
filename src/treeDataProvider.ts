import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { ConnectionConfig, DatabaseType } from './types';

export class DatabaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'database' | 'table' | 'collection' | 'key',
        public readonly connectionId?: string,
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

    constructor(private connectionManager: ConnectionManager) {}

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

            // For now, return placeholder items
            // These will be populated by actual database queries
            if (config.type === 'redis') {
                return [
                    new DatabaseTreeItem(
                        'Keys',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'database',
                        element.connectionId,
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
                        config.database
                    )
                ];
            } else {
                // MySQL/PostgreSQL
                return [
                    new DatabaseTreeItem(
                        'Tables',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'database',
                        element.connectionId,
                        'tables'
                    )
                ];
            }
        }

        return [];
    }
}
