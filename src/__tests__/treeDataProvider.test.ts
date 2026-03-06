import { DatabaseTreeItem, DatabaseTreeDataProvider } from '../treeDataProvider';
import * as vscode from 'vscode';

describe('DatabaseTreeItem', () => {
    it('should create a connection item with disconnected icon', () => {
        const item = new DatabaseTreeItem(
            'Test MySQL',
            vscode.TreeItemCollapsibleState.Collapsed,
            'connection',
            'conn-1',
            undefined,
            undefined,
            undefined,
            false
        );

        expect(item.label).toBe('Test MySQL');
        expect(item.contextValue).toBe('connection-disconnected');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('debug-disconnect');
    });

    it('should create a connection item with connected icon', () => {
        const item = new DatabaseTreeItem(
            'Test MySQL',
            vscode.TreeItemCollapsibleState.Collapsed,
            'connection',
            'conn-1',
            undefined,
            undefined,
            undefined,
            true
        );

        expect(item.contextValue).toBe('connection-connected');
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('database');
    });

    it('should create a table item with symbol-field icon', () => {
        const item = new DatabaseTreeItem(
            'users',
            vscode.TreeItemCollapsibleState.Collapsed,
            'table',
            'conn-1'
        );

        expect((item.iconPath as vscode.ThemeIcon).id).toBe('symbol-field');
    });

    it('should create a collection item with symbol-field icon', () => {
        const item = new DatabaseTreeItem(
            'users',
            vscode.TreeItemCollapsibleState.None,
            'collection',
            'conn-1'
        );

        expect((item.iconPath as vscode.ThemeIcon).id).toBe('symbol-field');
    });

    it('should create a key item with key icon', () => {
        const item = new DatabaseTreeItem(
            'mykey',
            vscode.TreeItemCollapsibleState.None,
            'key',
            'conn-1'
        );

        expect((item.iconPath as vscode.ThemeIcon).id).toBe('key');
    });

    it('should create a schema item with folder icon', () => {
        const item = new DatabaseTreeItem(
            'public',
            vscode.TreeItemCollapsibleState.Collapsed,
            'schema',
            'conn-1',
            'public'
        );

        expect((item.iconPath as vscode.ThemeIcon).id).toBe('folder');
    });

    it('should create a typeGroup item with database icon', () => {
        const item = new DatabaseTreeItem(
            'MySQL',
            vscode.TreeItemCollapsibleState.Expanded,
            'typeGroup',
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            undefined,
            { databaseType: 'mysql' }
        );

        expect(item.label).toBe('MySQL');
        expect(item.contextValue).toBe('typeGroup-disconnected');
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('database');
    });

    it('should create a database item with folder-library icon', () => {
        const item = new DatabaseTreeItem(
            'testdb',
            vscode.TreeItemCollapsibleState.Collapsed,
            'database',
            'conn-1',
            undefined,
            'testdb'
        );

        expect((item.iconPath as vscode.ThemeIcon).id).toBe('folder-library');
    });

    it('should create metadata folders with appropriate icons', () => {
        const columnsFolder = new DatabaseTreeItem(
            'Columns',
            vscode.TreeItemCollapsibleState.Collapsed,
            'metadataFolder',
            'conn-1',
            undefined,
            undefined,
            'users',
            false,
            'columns'
        );
        expect((columnsFolder.iconPath as vscode.ThemeIcon).id).toBe('symbol-field');

        const constraintsFolder = new DatabaseTreeItem(
            'Constraints',
            vscode.TreeItemCollapsibleState.Collapsed,
            'metadataFolder',
            'conn-1',
            undefined,
            undefined,
            'users',
            false,
            'constraints'
        );
        expect((constraintsFolder.iconPath as vscode.ThemeIcon).id).toBe('lock');

        const indexesFolder = new DatabaseTreeItem(
            'Indexes',
            vscode.TreeItemCollapsibleState.Collapsed,
            'metadataFolder',
            'conn-1',
            undefined,
            undefined,
            'users',
            false,
            'indexes'
        );
        expect((indexesFolder.iconPath as vscode.ThemeIcon).id).toBe('list-tree');

        const rulesFolder = new DatabaseTreeItem(
            'Rules',
            vscode.TreeItemCollapsibleState.Collapsed,
            'metadataFolder',
            'conn-1',
            undefined,
            undefined,
            'users',
            false,
            'rules'
        );
        expect((rulesFolder.iconPath as vscode.ThemeIcon).id).toBe('law');

        const triggersFolder = new DatabaseTreeItem(
            'Triggers',
            vscode.TreeItemCollapsibleState.Collapsed,
            'metadataFolder',
            'conn-1',
            undefined,
            undefined,
            'users',
            false,
            'triggers'
        );
        expect((triggersFolder.iconPath as vscode.ThemeIcon).id).toBe('zap');
    });

    it('should use folder icon for metadataFolder without folderType', () => {
        const item = new DatabaseTreeItem(
            'Unknown',
            vscode.TreeItemCollapsibleState.Collapsed,
            'metadataFolder',
            'conn-1',
            undefined,
            undefined,
            'users',
            false,
            undefined
        );
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('folder');
    });

    it('should create column item with symbol-field icon', () => {
        const item = new DatabaseTreeItem(
            'id: integer',
            vscode.TreeItemCollapsibleState.None,
            'column'
        );
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('symbol-field');
    });

    it('should create constraint items with correct icons', () => {
        const pk = new DatabaseTreeItem('pk', vscode.TreeItemCollapsibleState.None, 'constraint',
            undefined, undefined, undefined, undefined, false, undefined, { type: 'PRIMARY KEY' });
        expect((pk.iconPath as vscode.ThemeIcon).id).toBe('key');

        const fk = new DatabaseTreeItem('fk', vscode.TreeItemCollapsibleState.None, 'constraint',
            undefined, undefined, undefined, undefined, false, undefined, { type: 'FOREIGN KEY' });
        expect((fk.iconPath as vscode.ThemeIcon).id).toBe('references');

        const uq = new DatabaseTreeItem('uq', vscode.TreeItemCollapsibleState.None, 'constraint',
            undefined, undefined, undefined, undefined, false, undefined, { type: 'UNIQUE' });
        expect((uq.iconPath as vscode.ThemeIcon).id).toBe('shield');

        const ck = new DatabaseTreeItem('ck', vscode.TreeItemCollapsibleState.None, 'constraint',
            undefined, undefined, undefined, undefined, false, undefined, { type: 'CHECK' });
        expect((ck.iconPath as vscode.ThemeIcon).id).toBe('check');

        const other = new DatabaseTreeItem('other', vscode.TreeItemCollapsibleState.None, 'constraint',
            undefined, undefined, undefined, undefined, false, undefined, { type: 'OTHER' });
        expect((other.iconPath as vscode.ThemeIcon).id).toBe('lock');
    });

    it('should create index item with list-tree icon', () => {
        const item = new DatabaseTreeItem('idx', vscode.TreeItemCollapsibleState.None, 'index');
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('list-tree');
    });

    it('should create rule item with law icon', () => {
        const item = new DatabaseTreeItem('rule1', vscode.TreeItemCollapsibleState.None, 'rule');
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('law');
    });

    it('should create trigger item with zap icon', () => {
        const item = new DatabaseTreeItem('trg1', vscode.TreeItemCollapsibleState.None, 'trigger');
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('zap');
    });
});

describe('DatabaseTreeDataProvider', () => {
    let treeProvider: DatabaseTreeDataProvider;
    let mockConnectionManager: any;
    let mockDatabaseManager: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConnectionManager = {
            getAllConnections: jest.fn().mockReturnValue([]),
            getConnection: jest.fn(),
        };
        mockDatabaseManager = {
            getClient: jest.fn(),
        };
        treeProvider = new DatabaseTreeDataProvider(mockConnectionManager, mockDatabaseManager);
    });

    describe('refresh', () => {
        it('should fire onDidChangeTreeData event', () => {
            const listener = jest.fn();
            treeProvider.onDidChangeTreeData(listener);
            treeProvider.refresh();
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('setConnectionStatus', () => {
        it('should mark connection as connected', () => {
            treeProvider.setConnectionStatus('conn-1', true);
            expect(treeProvider.isConnected('conn-1')).toBe(true);
        });

        it('should mark connection as disconnected', () => {
            treeProvider.setConnectionStatus('conn-1', true);
            treeProvider.setConnectionStatus('conn-1', false);
            expect(treeProvider.isConnected('conn-1')).toBe(false);
        });

        it('should trigger refresh', () => {
            const listener = jest.fn();
            treeProvider.onDidChangeTreeData(listener);
            treeProvider.setConnectionStatus('conn-1', true);
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('getTreeItem', () => {
        it('should return the element itself', () => {
            const item = new DatabaseTreeItem('test', vscode.TreeItemCollapsibleState.None, 'table');
            expect(treeProvider.getTreeItem(item)).toBe(item);
        });
    });

    describe('getChildren - root level (type groups)', () => {
        it('should return type groups at root level', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'My MySQL', type: 'mysql' },
                { id: 'conn-2', name: 'My PostgreSQL', type: 'postgresql' },
            ]);

            const children = await treeProvider.getChildren();
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('typeGroup');
            expect(children[1].itemType).toBe('typeGroup');
        });

        it('should sort type groups alphanumerically', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'Redis Cache', type: 'redis' },
                { id: 'conn-2', name: 'My Mongo', type: 'mongodb' },
                { id: 'conn-3', name: 'My PG', type: 'postgresql' },
                { id: 'conn-4', name: 'My MySQL', type: 'mysql' },
            ]);

            const children = await treeProvider.getChildren();
            expect(children).toHaveLength(4);
            expect(children[0].label).toBe('MongoDB');
            expect(children[1].label).toBe('MySQL');
            expect(children[2].label).toBe('PostgreSQL');
            expect(children[3].label).toBe('Redis');
        });

        it('should use display names for type groups', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'DB', type: 'postgresql' },
            ]);

            const children = await treeProvider.getChildren();
            expect(children[0].label).toBe('PostgreSQL');
        });

        it('should store database type in metadata', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'DB', type: 'mysql' },
            ]);

            const children = await treeProvider.getChildren();
            expect(children[0].metadata).toEqual({ databaseType: 'mysql' });
        });

        it('should use database icon for type groups', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'DB', type: 'mysql' },
            ]);

            const children = await treeProvider.getChildren();
            expect((children[0].iconPath as vscode.ThemeIcon).id).toBe('database');
        });

        it('should group multiple connections of same type into one group', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'MySQL Prod', type: 'mysql' },
                { id: 'conn-2', name: 'MySQL Dev', type: 'mysql' },
                { id: 'conn-3', name: 'PG Prod', type: 'postgresql' },
            ]);

            const children = await treeProvider.getChildren();
            expect(children).toHaveLength(2);
            expect(children[0].label).toBe('MySQL');
            expect(children[1].label).toBe('PostgreSQL');
        });

        it('should return empty array when no connections', async () => {
            const children = await treeProvider.getChildren();
            expect(children).toEqual([]);
        });
    });

    describe('getChildren - type group level', () => {
        it('should return connections for a type group sorted alphanumerically', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'Zebra DB', type: 'mysql' },
                { id: 'conn-2', name: 'Alpha DB', type: 'mysql' },
                { id: 'conn-3', name: 'Middle DB', type: 'mysql' },
            ]);

            const typeGroupItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'typeGroup',
                undefined, undefined, undefined, undefined, false, undefined,
                { databaseType: 'mysql' }
            );

            const children = await treeProvider.getChildren(typeGroupItem);
            expect(children).toHaveLength(3);
            expect(children[0].label).toBe('Alpha DB');
            expect(children[1].label).toBe('Middle DB');
            expect(children[2].label).toBe('Zebra DB');
            expect(children[0].itemType).toBe('connection');
        });

        it('should only return connections matching the type', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'MySQL DB', type: 'mysql' },
                { id: 'conn-2', name: 'PG DB', type: 'postgresql' },
                { id: 'conn-3', name: 'Another MySQL', type: 'mysql' },
            ]);

            const typeGroupItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'typeGroup',
                undefined, undefined, undefined, undefined, false, undefined,
                { databaseType: 'mysql' }
            );

            const children = await treeProvider.getChildren(typeGroupItem);
            expect(children).toHaveLength(2);
            expect(children[0].label).toBe('Another MySQL');
            expect(children[1].label).toBe('MySQL DB');
        });

        it('should show connected status for connections in type group', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'MySQL DB', type: 'mysql' },
            ]);
            treeProvider.setConnectionStatus('conn-1', true);

            const typeGroupItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'typeGroup',
                undefined, undefined, undefined, undefined, false, undefined,
                { databaseType: 'mysql' }
            );

            const children = await treeProvider.getChildren(typeGroupItem);
            expect(children[0].isConnected).toBe(true);
        });

        it('should not include type in connection label', async () => {
            mockConnectionManager.getAllConnections.mockReturnValue([
                { id: 'conn-1', name: 'My Database', type: 'mysql' },
            ]);

            const typeGroupItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'typeGroup',
                undefined, undefined, undefined, undefined, false, undefined,
                { databaseType: 'mysql' }
            );

            const children = await treeProvider.getChildren(typeGroupItem);
            expect(children[0].label).toBe('My Database');
        });
    });

    describe('getChildren - connection level', () => {
        it('should return empty for disconnected connection', async () => {
            const connItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, false
            );
            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });

            const children = await treeProvider.getChildren(connItem);
            expect(children).toEqual([]);
        });

        it('should return empty when config not found', async () => {
            const connItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, false
            );
            mockConnectionManager.getConnection.mockReturnValue(undefined);

            const children = await treeProvider.getChildren(connItem);
            expect(children).toEqual([]);
        });

        it('should return schemas for connected PostgreSQL', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'PG', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getSchemas: jest.fn().mockResolvedValue(['public', 'custom']),
            });

            const children = await treeProvider.getChildren(connItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('schema');
            expect(children[0].label).toBe('public');
        });

        it('should return databases for connected MySQL', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getDatabases: jest.fn().mockResolvedValue(['myapp', 'analytics']),
            });

            const children = await treeProvider.getChildren(connItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('database');
            expect(children[0].label).toBe('myapp');
            expect(children[0].databaseName).toBe('myapp');
            expect(children[1].label).toBe('analytics');
        });

        it('should return Keys folder for connected Redis', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'Redis', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'redis' });
            mockDatabaseManager.getClient.mockReturnValue({});

            const children = await treeProvider.getChildren(connItem);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Keys');
            expect(children[0].itemType).toBe('database');
        });

        it('should return databases for connected MongoDB without specific database', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'MongoDB', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mongodb' });
            mockDatabaseManager.getClient.mockReturnValue({
                getDatabases: jest.fn().mockResolvedValue(['db1', 'db2']),
            });

            const children = await treeProvider.getChildren(connItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('database');
            expect(children[0].label).toBe('db1');
        });

        it('should return single database for MongoDB with specific database', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'MongoDB', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mongodb', database: 'mydb' });
            mockDatabaseManager.getClient.mockReturnValue({});

            const children = await treeProvider.getChildren(connItem);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('mydb');
        });

        it('should return empty on error', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'PG', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getSchemas: jest.fn().mockRejectedValue(new Error('Connection lost')),
            });

            const children = await treeProvider.getChildren(connItem);
            expect(children).toEqual([]);
        });

        it('should return empty when client not found', async () => {
            treeProvider.setConnectionStatus('conn-1', true);

            const connItem = new DatabaseTreeItem(
                'MySQL', vscode.TreeItemCollapsibleState.Collapsed, 'connection',
                'conn-1', undefined, undefined, undefined, true
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });
            mockDatabaseManager.getClient.mockReturnValue(undefined);

            const children = await treeProvider.getChildren(connItem);
            expect(children).toEqual([]);
        });
    });

    describe('getChildren - schema level', () => {
        it('should return tables for a schema', async () => {
            const schemaItem = new DatabaseTreeItem(
                'public', vscode.TreeItemCollapsibleState.Collapsed, 'schema',
                'conn-1', 'public'
            );

            mockDatabaseManager.getClient.mockReturnValue({
                getTables: jest.fn().mockResolvedValue(['users', 'orders']),
            });

            const children = await treeProvider.getChildren(schemaItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('table');
            expect(children[0].schemaName).toBe('public');
        });

        it('should return empty when client not found for schema', async () => {
            const schemaItem = new DatabaseTreeItem(
                'public', vscode.TreeItemCollapsibleState.Collapsed, 'schema',
                'conn-1', 'public'
            );

            mockDatabaseManager.getClient.mockReturnValue(undefined);

            const children = await treeProvider.getChildren(schemaItem);
            expect(children).toEqual([]);
        });

        it('should return empty on error', async () => {
            const schemaItem = new DatabaseTreeItem(
                'public', vscode.TreeItemCollapsibleState.Collapsed, 'schema',
                'conn-1', 'public'
            );

            mockDatabaseManager.getClient.mockReturnValue({
                getTables: jest.fn().mockRejectedValue(new Error('fail')),
            });

            const children = await treeProvider.getChildren(schemaItem);
            expect(children).toEqual([]);
        });
    });

    describe('getChildren - database level (MySQL)', () => {
        it('should return tables when expanding a MySQL database', async () => {
            const dbItem = new DatabaseTreeItem(
                'myapp', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'myapp'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getTables: jest.fn().mockResolvedValue(['users', 'orders', 'products']),
            });

            const children = await treeProvider.getChildren(dbItem);
            expect(children).toHaveLength(3);
            expect(children[0].itemType).toBe('table');
            expect(children[0].label).toBe('users');
            expect(children[0].tableName).toBe('users');
            expect(children[0].databaseName).toBe('myapp');
        });

        it('should pass database name to getTables for MySQL', async () => {
            const dbItem = new DatabaseTreeItem(
                'myapp', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'myapp'
            );

            const mockGetTables = jest.fn().mockResolvedValue(['users']);
            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getTables: mockGetTables,
            });

            await treeProvider.getChildren(dbItem);
            expect(mockGetTables).toHaveBeenCalledWith('myapp');
        });

        it('should return empty when MySQL database has no tables', async () => {
            const dbItem = new DatabaseTreeItem(
                'emptydb', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'emptydb'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getTables: jest.fn().mockResolvedValue([]),
            });

            const children = await treeProvider.getChildren(dbItem);
            expect(children).toEqual([]);
        });
    });

    describe('getChildren - database level (Redis/MongoDB)', () => {
        it('should return keys for Redis database', async () => {
            const dbItem = new DatabaseTreeItem(
                'Keys', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'keys'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'redis' });
            mockDatabaseManager.getClient.mockReturnValue({
                getKeys: jest.fn().mockResolvedValue([
                    { key: 'user:1', type: 'string' },
                    { key: 'user:2', type: 'hash' },
                ]),
            });

            const children = await treeProvider.getChildren(dbItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('key');
            expect(children[0].label).toBe('user:1 (string)');
        });

        it('should return collections for MongoDB database', async () => {
            const dbItem = new DatabaseTreeItem(
                'testdb', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'testdb'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mongodb' });
            mockDatabaseManager.getClient.mockReturnValue({
                getCollections: jest.fn().mockResolvedValue(['users', 'orders']),
            });

            const children = await treeProvider.getChildren(dbItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('collection');
        });

        it('should return empty when config not found', async () => {
            const dbItem = new DatabaseTreeItem(
                'testdb', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'testdb'
            );

            mockConnectionManager.getConnection.mockReturnValue(undefined);

            const children = await treeProvider.getChildren(dbItem);
            expect(children).toEqual([]);
        });

        it('should return empty on error', async () => {
            const dbItem = new DatabaseTreeItem(
                'testdb', vscode.TreeItemCollapsibleState.Collapsed, 'database',
                'conn-1', undefined, 'testdb'
            );

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'redis' });
            mockDatabaseManager.getClient.mockReturnValue({
                getKeys: jest.fn().mockRejectedValue(new Error('fail')),
            });

            const children = await treeProvider.getChildren(dbItem);
            expect(children).toEqual([]);
            consoleSpy.mockRestore();
        });
    });

    describe('getChildren - table level (metadata folders)', () => {
        it('should return metadata folders for PostgreSQL table', async () => {
            const tableItem = new DatabaseTreeItem(
                'users', vscode.TreeItemCollapsibleState.Collapsed, 'table',
                'conn-1', 'public', undefined, 'users'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });

            const children = await treeProvider.getChildren(tableItem);
            expect(children).toHaveLength(5); // columns, constraints, indexes, rules, triggers
            expect(children.map(c => c.label)).toContain('Columns');
            expect(children.map(c => c.label)).toContain('Rules');
        });

        it('should return metadata folders for MySQL table (no rules)', async () => {
            const tableItem = new DatabaseTreeItem(
                'users', vscode.TreeItemCollapsibleState.Collapsed, 'table',
                'conn-1', undefined, undefined, 'users'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });

            const children = await treeProvider.getChildren(tableItem);
            expect(children).toHaveLength(4); // columns, constraints, indexes, triggers (no rules)
            expect(children.map(c => c.label)).not.toContain('Rules');
        });
    });

    describe('getChildren - metadata folder expansion', () => {
        it('should return column items', async () => {
            const folderItem = new DatabaseTreeItem(
                'Columns', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'users', false, 'columns'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getColumns: jest.fn().mockResolvedValue([
                    { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
                    { name: 'name', type: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false },
                ]),
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toHaveLength(2);
            expect(children[0].itemType).toBe('column');
            expect(children[0].label).toContain('id');
            expect(children[0].label).toContain('PK');
            expect(children[0].label).toContain('NOT NULL');
        });

        it('should show FK reference in column label', async () => {
            const folderItem = new DatabaseTreeItem(
                'Columns', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'orders', false, 'columns'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getColumns: jest.fn().mockResolvedValue([
                    {
                        name: 'user_id', type: 'integer', nullable: false,
                        isPrimaryKey: false, isForeignKey: true,
                        referencedTable: 'users', referencedColumn: 'id',
                    },
                ]),
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children[0].label).toContain('FK → users.id');
        });

        it('should return constraint items', async () => {
            const folderItem = new DatabaseTreeItem(
                'Constraints', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'users', false, 'constraints'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getConstraints: jest.fn().mockResolvedValue([
                    { name: 'users_pkey', type: 'PRIMARY KEY', columns: ['id'] },
                    { name: 'fk_order', type: 'FOREIGN KEY', columns: ['order_id'], referencedTable: 'orders' },
                ]),
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toHaveLength(2);
            expect(children[0].label).toContain('PRIMARY KEY');
            expect(children[1].label).toContain('FK → orders');
        });

        it('should return index items', async () => {
            const folderItem = new DatabaseTreeItem(
                'Indexes', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'users', false, 'indexes'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getIndexes: jest.fn().mockResolvedValue([
                    { name: 'users_pkey', columns: ['id'], isUnique: true, isPrimary: true, type: 'btree' },
                ]),
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toHaveLength(1);
            expect(children[0].label).toContain('btree');
            expect(children[0].label).toContain('unique');
            expect(children[0].label).toContain('primary');
        });

        it('should return rule items for PostgreSQL', async () => {
            const folderItem = new DatabaseTreeItem(
                'Rules', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'users', false, 'rules'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getRules: jest.fn().mockResolvedValue([
                    { name: 'rule1', event: 'SELECT', definition: 'CREATE RULE ...' },
                ]),
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toHaveLength(1);
            expect(children[0].label).toContain('rule1');
            expect(children[0].label).toContain('SELECT');
        });

        it('should return empty for rules on non-PostgreSQL', async () => {
            const folderItem = new DatabaseTreeItem(
                'Rules', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', undefined, undefined, 'users', false, 'rules'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'mysql' });
            mockDatabaseManager.getClient.mockReturnValue({});

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toEqual([]);
        });

        it('should return trigger items', async () => {
            const folderItem = new DatabaseTreeItem(
                'Triggers', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'users', false, 'triggers'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            mockDatabaseManager.getClient.mockReturnValue({
                getTriggers: jest.fn().mockResolvedValue([
                    { name: 'trg1', timing: 'BEFORE', event: 'INSERT' },
                ]),
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toHaveLength(1);
            expect(children[0].label).toContain('BEFORE INSERT');
        });

        it('should return empty on error in metadata', async () => {
            const folderItem = new DatabaseTreeItem(
                'Columns', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                'conn-1', 'public', undefined, 'users', false, 'columns'
            );

            mockConnectionManager.getConnection.mockReturnValue({ id: 'conn-1', type: 'postgresql' });
            const mockGetColumns = jest.fn().mockRejectedValue(new Error('fail'));
            mockDatabaseManager.getClient.mockReturnValue({
                getColumns: mockGetColumns,
            });

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toEqual([]);
            expect(mockGetColumns).toHaveBeenCalled();
        });

        it('should return empty when metadata folder has missing info', async () => {
            const folderItem = new DatabaseTreeItem(
                'Columns', vscode.TreeItemCollapsibleState.Collapsed, 'metadataFolder',
                undefined, undefined, undefined, undefined, false, 'columns'
            );

            const children = await treeProvider.getChildren(folderItem);
            expect(children).toEqual([]);
        });
    });

    describe('getChildren - unknown item types', () => {
        it('should return empty for unhandled item types', async () => {
            const item = new DatabaseTreeItem(
                'unknown', vscode.TreeItemCollapsibleState.None, 'column'
            );
            const children = await treeProvider.getChildren(item);
            expect(children).toEqual([]);
        });
    });
});
