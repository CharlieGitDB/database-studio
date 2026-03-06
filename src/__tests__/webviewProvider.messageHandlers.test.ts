import { SavedQuery, QueryBuilderState } from '../types';

// Must declare mock fns before jest.mock calls since they get hoisted
const mockPostMessage = jest.fn();
const mockCreateWebviewPanel = jest.fn();
const mockShowWarningMessage = jest.fn();
const mockShowInformationMessage = jest.fn();
const mockShowErrorMessage = jest.fn();

jest.mock('vscode', () => ({
    window: {
        activeTextEditor: undefined,
        createWebviewPanel: (...args: any[]) => mockCreateWebviewPanel(...args),
        showInformationMessage: mockShowInformationMessage,
        showErrorMessage: mockShowErrorMessage,
        showWarningMessage: mockShowWarningMessage,
    },
    ViewColumn: { One: 1, Two: 2 },
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        joinPath: (base: any, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        }),
    },
}));

// Mock client modules with class-based mocks so instanceof checks work
const mockMySQLGetTableData = jest.fn();
const mockMySQLExecuteQuery = jest.fn();
const mockMySQLUpdateRecord = jest.fn();
const mockMySQLDeleteRecord = jest.fn();
const mockMySQLGetColumns = jest.fn();
const mockMySQLGetTables = jest.fn();

jest.mock('../clients/mysqlClient', () => {
    class MockMySQLClient {
        getTableData = mockMySQLGetTableData;
        executeQuery = mockMySQLExecuteQuery;
        updateRecord = mockMySQLUpdateRecord;
        deleteRecord = mockMySQLDeleteRecord;
        getColumns = mockMySQLGetColumns;
        getTables = mockMySQLGetTables;
        isConnected = jest.fn().mockReturnValue(true);
    }
    return { MySQLClient: MockMySQLClient };
});

const mockPGGetTableData = jest.fn();
const mockPGExecuteQuery = jest.fn();
const mockPGUpdateRecord = jest.fn();
const mockPGDeleteRecord = jest.fn();
const mockPGGetColumns = jest.fn();
const mockPGGetTables = jest.fn();
const mockPGClientQuery = jest.fn();

jest.mock('../clients/postgresClient', () => {
    class MockPostgresClient {
        getTableData = mockPGGetTableData;
        executeQuery = mockPGExecuteQuery;
        updateRecord = mockPGUpdateRecord;
        deleteRecord = mockPGDeleteRecord;
        getColumns = mockPGGetColumns;
        getTables = mockPGGetTables;
        isConnected = jest.fn().mockReturnValue(true);
        client = { query: mockPGClientQuery };
    }
    return { PostgresClient: MockPostgresClient };
});

const mockRedisGetKeys = jest.fn();
const mockRedisGetValue = jest.fn();
const mockRedisSetValue = jest.fn();
const mockRedisDeleteKey = jest.fn();

jest.mock('../clients/redisClient', () => {
    class MockRedisClient {
        getKeys = mockRedisGetKeys;
        getValue = mockRedisGetValue;
        setValue = mockRedisSetValue;
        deleteKey = mockRedisDeleteKey;
        isConnected = jest.fn().mockReturnValue(true);
    }
    return { RedisClient: MockRedisClient };
});

const mockMongoGetCollectionData = jest.fn();
const mockMongoUpdateDocument = jest.fn();
const mockMongoDeleteDocument = jest.fn();
const mockMongoExecuteQuery = jest.fn();
const mockMongoInsertDocument = jest.fn();
const mockMongoAggregate = jest.fn();
const mockMongoGetIndexes = jest.fn();
const mockMongoCreateIndex = jest.fn();
const mockMongoDropIndex = jest.fn();
const mockMongoGetDocumentById = jest.fn();

jest.mock('../clients/mongoClient', () => {
    class MockMongoDBClient {
        getCollectionData = mockMongoGetCollectionData;
        updateDocument = mockMongoUpdateDocument;
        deleteDocument = mockMongoDeleteDocument;
        executeQuery = mockMongoExecuteQuery;
        insertDocument = mockMongoInsertDocument;
        aggregate = mockMongoAggregate;
        getIndexes = mockMongoGetIndexes;
        createIndex = mockMongoCreateIndex;
        dropIndex = mockMongoDropIndex;
        getDocumentById = mockMongoGetDocumentById;
        isConnected = jest.fn().mockReturnValue(true);
    }
    return { MongoDBClient: MockMongoDBClient };
});

jest.mock('../mongoWebview', () => ({
    getMongoDBWebviewContent: jest.fn().mockReturnValue('<html>mongo</html>'),
}));

jest.mock('../queryBuilder', () => ({
    QueryBuilder: {
        generateSQL: jest.fn().mockReturnValue('SELECT * FROM "users";'),
        validate: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    },
}));

import { DataViewerPanel } from '../webviewProvider';
import { MySQLClient } from '../clients/mysqlClient';
import { PostgresClient } from '../clients/postgresClient';
import { RedisClient } from '../clients/redisClient';
import { MongoDBClient } from '../clients/mongoClient';
import { QueryBuilder } from '../queryBuilder';

describe('DataViewerPanel - Message Handlers', () => {
    let mockDatabaseManager: any;
    let mockConnectionManager: any;
    let messageHandler: (message: any) => Promise<void>;
    let panelWebview: any;

    function createMockPanel() {
        panelWebview = {
            html: '',
            onDidReceiveMessage: (handler: any) => {
                messageHandler = handler;
                return { dispose: jest.fn() };
            },
            postMessage: mockPostMessage,
            asWebviewUri: jest.fn((uri: any) => uri),
            cspSource: 'mock-csp',
        };
        return {
            webview: panelWebview,
            onDidDispose: (_handler: any) => ({ dispose: jest.fn() }),
            reveal: jest.fn(),
            dispose: jest.fn(),
        };
    }

    function waitForHtml(): Promise<string> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(panelWebview.html), 100);
        });
    }

    beforeEach(() => {
        jest.clearAllMocks();
        DataViewerPanel.currentPanel = undefined;
        mockCreateWebviewPanel.mockImplementation(() => createMockPanel());
    });

    describe('Redis operations', () => {
        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'Redis', type: 'redis', host: 'localhost', port: 6379,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            const redisClient = new RedisClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(redisClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'unknown', tables: {} }),
            };

            mockRedisGetKeys.mockResolvedValue([
                { key: 'key1', type: 'string', ttl: -1 },
            ]);
            mockRedisGetValue.mockResolvedValue({
                columns: ['Key', 'Type', 'Value'],
                rows: [['key1', 'string', '"hello"']],
            });
        });

        it('should load Redis keys data', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1', 'keys'
            );

            const html = await waitForHtml();
            expect(html).toContain('Key');
            expect(mockRedisGetKeys).toHaveBeenCalled();
        });

        it('should load specific Redis key value', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1', 'mykey'
            );

            await waitForHtml();
            expect(mockRedisGetValue).toHaveBeenCalledWith('mykey');
        });

        it('should edit a Redis key', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1', 'mykey'
            );

            await waitForHtml();
            await messageHandler({
                command: 'edit',
                connectionId: 'conn-1',
                resource: 'mykey',
                data: { key: 'mykey', value: 'newval', type: 'string' },
            });

            expect(mockRedisSetValue).toHaveBeenCalledWith('mykey', 'newval', 'string');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Record updated successfully');
        });

        it('should delete a Redis key', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1', 'mykey'
            );

            await waitForHtml();
            await messageHandler({
                command: 'delete',
                connectionId: 'conn-1',
                resource: 'mykey',
                data: { key: 'mykey' },
            });

            expect(mockRedisDeleteKey).toHaveBeenCalledWith('mykey');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Record deleted successfully');
        });
    });

    describe('MySQL operations', () => {
        let mysqlClient: MySQLClient;

        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            mysqlClient = new MySQLClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mysqlClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'mysql', tables: { users: ['id', 'name'] } }),
            };

            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id', 'name'], rows: [[1, 'Alice']], columnTypes: ['other', 'other'],
            });
        });

        it('should edit a MySQL record', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'edit',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1, updates: { name: 'Bob' } },
            });

            expect(mockMySQLUpdateRecord).toHaveBeenCalledWith('users', 'id', 1, { name: 'Bob' });
        });

        it('should delete a MySQL record', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'delete',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1 },
            });

            expect(mockMySQLDeleteRecord).toHaveBeenCalledWith('users', 'id', 1);
        });

        it('should execute a MySQL query', async () => {
            mockMySQLExecuteQuery.mockResolvedValue({
                columns: ['id', 'name'], rows: [[1, 'Alice']], columnTypes: ['other', 'other'],
            });

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'SELECT * FROM users',
            });

            expect(mockMySQLExecuteQuery).toHaveBeenCalledWith('SELECT * FROM users');
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'queryResults' })
            );
        });

        it('should get MySQL columns', async () => {
            mockMySQLGetColumns.mockResolvedValue([
                { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, isForeignKey: false },
            ]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getColumns',
                connectionId: 'conn-1',
                resource: 'users',
            });

            expect(mockMySQLGetColumns).toHaveBeenCalledWith('users');
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'columnsData' })
            );
        });

        it('should get MySQL tables', async () => {
            mockMySQLGetTables.mockResolvedValue(['users', 'orders']);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getTables',
                connectionId: 'conn-1',
            });

            expect(mockMySQLGetTables).toHaveBeenCalled();
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'tablesData', tables: ['users', 'orders'] })
            );
        });
    });

    describe('PostgreSQL operations', () => {
        let pgClient: PostgresClient;

        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'PG', type: 'postgresql', host: 'localhost', port: 5432,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            pgClient = new PostgresClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(pgClient),
                getSchemaInfo: jest.fn().mockResolvedValue({
                    dbType: 'postgresql', tables: { users: ['id', 'name'] }, schemas: ['public'],
                    schemaTablesMap: { public: { users: ['id', 'name'] } },
                }),
            };

            mockPGGetTableData.mockResolvedValue({
                columns: ['id', 'name'], rows: [[1, 'Alice']], columnTypes: ['other', 'other'],
            });
        });

        it('should edit a PostgreSQL record with schema', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'public'
            );

            await waitForHtml();
            await messageHandler({
                command: 'edit',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1, updates: { name: 'Bob' } },
                schema: 'public',
            });

            expect(mockPGUpdateRecord).toHaveBeenCalledWith('users', 'id', 1, { name: 'Bob' }, 'public');
        });

        it('should delete a PostgreSQL record with schema', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'public'
            );

            await waitForHtml();
            await messageHandler({
                command: 'delete',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1 },
                schema: 'public',
            });

            expect(mockPGDeleteRecord).toHaveBeenCalledWith('users', 'id', 1, 'public');
        });

        it('should set search_path before executing PG query', async () => {
            mockPGExecuteQuery.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'public'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'SELECT * FROM users',
                schema: 'public',
            });

            expect(mockPGClientQuery).toHaveBeenCalledWith(
                expect.stringContaining('SET search_path TO')
            );
            expect(mockPGExecuteQuery).toHaveBeenCalledWith('SELECT * FROM users');
        });

        it('should get PostgreSQL columns with schema', async () => {
            mockPGGetColumns.mockResolvedValue([
                { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
            ]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'public'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getColumns',
                connectionId: 'conn-1',
                resource: 'users',
                schema: 'public',
            });

            expect(mockPGGetColumns).toHaveBeenCalledWith('users', 'public');
        });

        it('should get PostgreSQL tables with schema', async () => {
            mockPGGetTables.mockResolvedValue(['users', 'orders']);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'public'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getTables',
                connectionId: 'conn-1',
                schema: 'custom',
            });

            expect(mockPGGetTables).toHaveBeenCalledWith('custom');
        });
    });

    describe('MongoDB operations', () => {
        let mongoClient: MongoDBClient;

        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'Mongo', type: 'mongodb', host: 'localhost', port: 27017,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            mongoClient = new MongoDBClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mongoClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'unknown', tables: {} }),
            };

            mockMongoGetCollectionData.mockResolvedValue({
                columns: ['_id', 'name'], rows: [['id1', 'Alice']],
            });
        });

        it('should edit a MongoDB document', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'edit',
                connectionId: 'conn-1',
                resource: 'users',
                data: { id: 'abc123', updates: { name: 'Bob' } },
                schema: 'testdb',
            });

            expect(mockMongoUpdateDocument).toHaveBeenCalledWith('users', 'abc123', { name: 'Bob' }, 'testdb');
        });

        it('should delete a MongoDB document', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'delete',
                connectionId: 'conn-1',
                resource: 'users',
                data: { id: 'abc123' },
                schema: 'testdb',
            });

            expect(mockMongoDeleteDocument).toHaveBeenCalledWith('users', 'abc123', 'testdb');
        });

        it('should insert a MongoDB document', async () => {
            mockMongoInsertDocument.mockResolvedValue('new-id-123');

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'insertDocument',
                connectionId: 'conn-1',
                resource: 'users',
                document: '{"name":"Charlie","age":30}',
            });

            expect(mockMongoInsertDocument).toHaveBeenCalledWith(
                'users', { name: 'Charlie', age: 30 }, 'testdb'
            );
            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('new-id-123')
            );
        });

        it('should handle insert error for invalid JSON', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'insertDocument',
                connectionId: 'conn-1',
                resource: 'users',
                document: 'not-json',
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to insert document')
            );
        });

        it('should execute aggregation pipeline', async () => {
            mockMongoAggregate.mockResolvedValue({
                columns: ['_id', 'count'], rows: [['group1', 5]],
            });

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeAggregate',
                connectionId: 'conn-1',
                resource: 'users',
                pipeline: '[{"$group":{"_id":"$type","count":{"$sum":1}}}]',
            });

            expect(mockMongoAggregate).toHaveBeenCalledWith(
                'users',
                [{ $group: { _id: '$type', count: { $sum: 1 } } }],
                'testdb'
            );
        });

        it('should get indexes', async () => {
            mockMongoGetIndexes.mockResolvedValue([{ v: 2, key: { _id: 1 }, name: '_id_' }]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getIndexes',
                connectionId: 'conn-1',
                resource: 'users',
            });

            expect(mockMongoGetIndexes).toHaveBeenCalledWith('users', 'testdb');
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'showIndexes' })
            );
        });

        it('should create index', async () => {
            mockMongoCreateIndex.mockResolvedValue('name_1');
            mockMongoGetIndexes.mockResolvedValue([]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'createIndex',
                connectionId: 'conn-1',
                resource: 'users',
                keys: '{"name":1}',
                options: '{"unique":true}',
            });

            expect(mockMongoCreateIndex).toHaveBeenCalledWith(
                'users', { name: 1 }, { unique: true }, 'testdb'
            );
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Index created: name_1');
        });

        it('should create index without options', async () => {
            mockMongoCreateIndex.mockResolvedValue('name_1');
            mockMongoGetIndexes.mockResolvedValue([]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'createIndex',
                connectionId: 'conn-1',
                resource: 'users',
                keys: '{"name":1}',
                options: undefined,
            });

            expect(mockMongoCreateIndex).toHaveBeenCalledWith(
                'users', { name: 1 }, undefined, 'testdb'
            );
        });

        it('should drop index', async () => {
            mockMongoGetIndexes.mockResolvedValue([]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'dropIndex',
                connectionId: 'conn-1',
                resource: 'users',
                indexName: 'name_1',
            });

            expect(mockMongoDropIndex).toHaveBeenCalledWith('users', 'name_1', 'testdb');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Index dropped: name_1');
        });

        it('should get document by id', async () => {
            mockMongoGetDocumentById.mockResolvedValue({ _id: 'abc', name: 'Alice' });

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users', 'testdb'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getDocument',
                connectionId: 'conn-1',
                resource: 'users',
                id: 'abc',
            });

            expect(mockMongoGetDocumentById).toHaveBeenCalledWith('users', 'abc', 'testdb');
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'showDocument',
                    document: { _id: 'abc', name: 'Alice' },
                })
            );
        });

        it('should show error for non-MongoDB insert', async () => {
            // Use a MySQL client instead
            mockConnectionManager.getConnection.mockReturnValue({
                id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
            });
            const mysqlClient = new MySQLClient();
            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });
            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'insertDocument',
                connectionId: 'conn-1',
                resource: 'users',
                document: '{}',
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith('Invalid client for MongoDB operation');
        });
    });

    describe('Update protection', () => {
        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
                    updateProtection: true,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            const mysqlClient = new MySQLClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mysqlClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'mysql', tables: {} }),
            };

            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });
        });

        it('should prompt for confirmation on write query with update protection', async () => {
            mockShowWarningMessage.mockResolvedValue('Cancel');

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'DELETE FROM users WHERE id = 1',
            });

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('modify the database'),
                expect.any(Object),
                'Execute',
                'Cancel'
            );
            // Query should be cancelled
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'queryError',
                    error: 'Query execution cancelled by user',
                })
            );
        });

        it('should execute write query when user confirms', async () => {
            mockShowWarningMessage.mockResolvedValue('Execute');
            mockMySQLExecuteQuery.mockResolvedValue({
                columns: ['affectedRows'], rows: [[1]],
            });

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'DELETE FROM users WHERE id = 1',
            });

            expect(mockMySQLExecuteQuery).toHaveBeenCalled();
        });

        it('should not prompt for SELECT queries with update protection', async () => {
            mockMySQLExecuteQuery.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'SELECT * FROM users',
            });

            expect(mockShowWarningMessage).not.toHaveBeenCalled();
            expect(mockMySQLExecuteQuery).toHaveBeenCalled();
        });
    });

    describe('Query Builder / generateSQL', () => {
        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            const mysqlClient = new MySQLClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mysqlClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'mysql', tables: {} }),
            };

            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });
        });

        it('should generate SQL and send validation', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            const builderState: QueryBuilderState = {
                table: 'users', distinct: false, selectColumns: [],
                filters: [], joins: [], orderBy: [], groupBy: [],
            };

            await messageHandler({
                command: 'generateSQL',
                builderState,
                dbType: 'mysql',
            });

            expect(QueryBuilder.generateSQL).toHaveBeenCalledWith(builderState, 'mysql');
            expect(QueryBuilder.validate).toHaveBeenCalledWith(builderState);
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'generatedSQL',
                    sql: expect.any(String),
                    validation: expect.objectContaining({ valid: true }),
                })
            );
        });
    });

    describe('Saved Queries', () => {
        let mockGlobalState: any;

        beforeEach(() => {
            mockGlobalState = {
                get: jest.fn().mockReturnValue([]),
                update: jest.fn().mockResolvedValue(undefined),
            };

            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
                }),
                getContext: jest.fn().mockReturnValue({ globalState: mockGlobalState }),
            };

            const mysqlClient = new MySQLClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mysqlClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'mysql', tables: {} }),
            };

            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });
        });

        it('should save a new query', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();

            const query: SavedQuery = {
                id: 'q-1',
                name: 'All Users',
                state: { table: 'users', distinct: false, selectColumns: [], filters: [], joins: [], orderBy: [], groupBy: [] },
                sql: 'SELECT * FROM users;',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            await messageHandler({ command: 'saveQuery', query });

            expect(mockGlobalState.update).toHaveBeenCalledWith(
                'savedQueries',
                expect.arrayContaining([expect.objectContaining({ id: 'q-1', name: 'All Users' })])
            );
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Query saved successfully');
        });

        it('should update an existing saved query', async () => {
            mockGlobalState.get.mockReturnValue([
                { id: 'q-1', name: 'Old Name', state: { table: 'users' }, sql: 'SELECT 1;', createdAt: 100, updatedAt: 100 },
            ]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'saveQuery',
                query: { id: 'q-1', name: 'New Name', state: { table: 'users' }, sql: 'SELECT *;', createdAt: 100, updatedAt: 200 },
            });

            const savedQueries = mockGlobalState.update.mock.calls[0][1];
            expect(savedQueries).toHaveLength(1);
            expect(savedQueries[0].name).toBe('New Name');
        });

        it('should load a saved query', async () => {
            mockGlobalState.get.mockReturnValue([
                { id: 'q-1', name: 'My Query', state: { table: 'users' }, sql: 'SELECT *;', createdAt: 100, updatedAt: 100 },
            ]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({ command: 'loadQuery', queryId: 'q-1' });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'loadedQuery',
                    query: expect.objectContaining({ id: 'q-1' }),
                })
            );
        });

        it('should show error when loading non-existent query', async () => {
            mockGlobalState.get.mockReturnValue([]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({ command: 'loadQuery', queryId: 'nonexistent' });

            expect(mockShowErrorMessage).toHaveBeenCalledWith('Query not found');
        });

        it('should get saved queries for a table', async () => {
            mockGlobalState.get.mockReturnValue([
                { id: 'q-1', name: 'Q1', state: { table: 'users' }, sql: 'SELECT 1;', createdAt: 100, updatedAt: 100 },
                { id: 'q-2', name: 'Q2', state: { table: 'orders' }, sql: 'SELECT 2;', createdAt: 100, updatedAt: 100 },
            ]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({ command: 'getSavedQueries', table: 'users' });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'savedQueriesList',
                    queries: [expect.objectContaining({ id: 'q-1' })],
                })
            );
        });

        it('should return all saved queries when no table specified', async () => {
            mockGlobalState.get.mockReturnValue([
                { id: 'q-1', state: { table: 'users' } },
                { id: 'q-2', state: { table: 'orders' } },
            ]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({ command: 'getSavedQueries' });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'savedQueriesList',
                    queries: expect.arrayContaining([
                        expect.objectContaining({ id: 'q-1' }),
                        expect.objectContaining({ id: 'q-2' }),
                    ]),
                })
            );
        });
    });

    describe('Schema Info', () => {
        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            const mysqlClient = new MySQLClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mysqlClient),
                getSchemaInfo: jest.fn().mockResolvedValue({
                    dbType: 'mysql',
                    tables: { users: ['id', 'name'], orders: ['id', 'total'] },
                }),
            };

            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });
        });

        it('should send schema info', async () => {
            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getSchemaInfo',
                connectionId: 'conn-1',
            });

            expect(mockDatabaseManager.getSchemaInfo).toHaveBeenCalledWith('conn-1', undefined);
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'schemaInfo',
                    schemaInfo: { users: ['id', 'name'], orders: ['id', 'total'] },
                })
            );
        });

        it('should handle schema info error', async () => {
            mockDatabaseManager.getSchemaInfo.mockRejectedValueOnce(new Error('Connection lost'));

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await messageHandler({
                command: 'getSchemaInfo',
                connectionId: 'conn-1',
            });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'schemaInfoError' })
            );
            consoleSpy.mockRestore();
        });
    });

    describe('Error handling', () => {
        beforeEach(() => {
            mockConnectionManager = {
                getConnection: jest.fn().mockReturnValue({
                    id: 'conn-1', name: 'MySQL', type: 'mysql', host: 'localhost', port: 3306,
                }),
                getContext: jest.fn().mockReturnValue({
                    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn().mockResolvedValue(undefined) },
                }),
            };

            const mysqlClient = new MySQLClient();
            mockDatabaseManager = {
                getClient: jest.fn().mockReturnValue(mysqlClient),
                getSchemaInfo: jest.fn().mockResolvedValue({ dbType: 'mysql', tables: {} }),
            };

            mockMySQLGetTableData.mockResolvedValue({
                columns: ['id'], rows: [[1]], columnTypes: ['other'],
            });
        });

        it('should show error when connection not found for edit', async () => {
            mockDatabaseManager.getClient.mockReturnValueOnce(new MySQLClient()).mockReturnValue(null);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'edit',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1, updates: {} },
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith('Connection not found');
        });

        it('should show error when edit fails', async () => {
            mockMySQLUpdateRecord.mockRejectedValueOnce(new Error('Update failed'));

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'edit',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1, updates: { name: 'x' } },
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to update record')
            );
        });

        it('should show error when delete fails', async () => {
            mockMySQLDeleteRecord.mockRejectedValueOnce(new Error('Delete failed'));

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'delete',
                connectionId: 'conn-1',
                resource: 'users',
                data: { primaryKey: 'id', primaryKeyValue: 1 },
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete record')
            );
        });

        it('should show error when executeQuery fails', async () => {
            mockMySQLExecuteQuery.mockRejectedValueOnce(new Error('Syntax error'));

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'INVALID SQL',
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to execute query')
            );
        });

        it('should show error for getColumns when client not found', async () => {
            mockDatabaseManager.getClient.mockReturnValueOnce(new MySQLClient()).mockReturnValue(null);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getColumns',
                connectionId: 'conn-1',
                resource: 'users',
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith('Connection not found');
        });

        it('should return empty columns for Redis client', async () => {
            const redisClient = new RedisClient();
            mockDatabaseManager.getClient.mockReturnValue(redisClient);
            mockConnectionManager.getConnection.mockReturnValue({
                id: 'conn-1', name: 'Redis', type: 'redis', host: 'localhost', port: 6379,
            });
            mockRedisGetKeys.mockResolvedValue([]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'keys'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getColumns',
                connectionId: 'conn-1',
                resource: 'keys',
            });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'columnsData', columns: [] })
            );
        });

        it('should return empty tables for Redis client', async () => {
            const redisClient = new RedisClient();
            mockDatabaseManager.getClient.mockReturnValue(redisClient);
            mockConnectionManager.getConnection.mockReturnValue({
                id: 'conn-1', name: 'Redis', type: 'redis', host: 'localhost', port: 6379,
            });
            mockRedisGetKeys.mockResolvedValue([]);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager, mockConnectionManager, 'conn-1', 'keys'
            );

            await waitForHtml();
            await messageHandler({
                command: 'getTables',
                connectionId: 'conn-1',
            });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: 'tablesData', tables: [] })
            );
        });
    });
});
