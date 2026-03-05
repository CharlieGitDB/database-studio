import { QueryResult } from '../types';

// Must declare mock fns before jest.mock calls since they get hoisted
const mockPostMessage = jest.fn();
const mockOnDidReceiveMessage = jest.fn();
const mockOnDidDispose = jest.fn();
const mockAsWebviewUri = jest.fn((uri: any) => uri);
const mockReveal = jest.fn();
const mockDispose = jest.fn();
const mockCreateWebviewPanel = jest.fn();

jest.mock('vscode', () => ({
    window: {
        activeTextEditor: undefined,
        createWebviewPanel: (...args: any[]) => mockCreateWebviewPanel(...args),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
    },
    ViewColumn: { One: 1, Two: 2 },
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        joinPath: (base: any, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        }),
    },
}));

// Mock client modules
jest.mock('../clients/redisClient', () => ({
    RedisClient: jest.fn(),
}));
jest.mock('../clients/mysqlClient', () => {
    class MockMySQLClient {
        getTableData = jest.fn();
        executeQuery = jest.fn();
        isConnected = jest.fn().mockReturnValue(true);
    }
    return { MySQLClient: MockMySQLClient };
});
jest.mock('../clients/postgresClient', () => {
    class MockPostgresClient {
        getTableData = jest.fn();
        executeQuery = jest.fn();
        isConnected = jest.fn().mockReturnValue(true);
        client = { query: jest.fn() };
    }
    return { PostgresClient: MockPostgresClient };
});
jest.mock('../clients/mongoClient', () => ({
    MongoDBClient: jest.fn(),
}));
jest.mock('../mongoWebview', () => ({
    getMongoDBWebviewContent: jest.fn().mockReturnValue('<html>mongo</html>'),
}));
jest.mock('../queryBuilder', () => ({
    QueryBuilder: jest.fn().mockImplementation(() => ({
        generateSQL: jest.fn().mockReturnValue('SELECT 1'),
    })),
}));

import { DataViewerPanel } from '../webviewProvider';
import { MySQLClient } from '../clients/mysqlClient';
import { PostgresClient } from '../clients/postgresClient';

describe('DataViewerPanel - JSON column type support', () => {
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
            asWebviewUri: mockAsWebviewUri,
            cspSource: 'mock-csp',
        };
        return {
            webview: panelWebview,
            onDidDispose: (handler: any) => ({ dispose: jest.fn() }),
            reveal: mockReveal,
            dispose: mockDispose,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateWebviewPanel.mockImplementation(() => createMockPanel());

        mockConnectionManager = {
            getConnection: jest.fn().mockReturnValue({
                id: 'conn-1',
                name: 'Test Connection',
                type: 'mysql',
                host: 'localhost',
                port: 3306,
            }),
        };

        mockDatabaseManager = {
            getClient: jest.fn(),
        };
    });

    // Helper to wait for async loadData
    function waitForHtml(): Promise<string> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(panelWebview.html), 100);
        });
    }

    describe('MySQL JSON column rendering', () => {
        it('should include columnTypes in webview HTML when data has JSON columns', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'metadata'],
                rows: [[1, '{"key":"value"}']],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            expect(html).toContain('"columnTypes":["other","json"]');
            expect(html).toContain('json-cell');
        });

        it('should include json-cell CSS and all JSON functions in the webview', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'data'],
                rows: [[1, '{}']],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            expect(html).toContain('.json-cell');
            expect(html).toContain('.json-modal-overlay');
            expect(html).toContain('showJsonModal');
            expect(html).toContain('closeJsonModal');
            expect(html).toContain('copyJsonToClipboard');
            expect(html).toContain('function isJsonColumn');
        });

        it('should include the CodeMirror JavaScript mode script', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id'],
                rows: [[1]],
                columnTypes: ['other'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            expect(html).toContain('mode/javascript/javascript.min.js');
        });

        it('should render non-JSON columns without json-cell class in table body', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'name'],
                rows: [[1, 'Alice']],
                columnTypes: ['other', 'other'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            expect(html).toContain('"columnTypes":["other","other"]');
            const tableBodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
            if (tableBodyMatch) {
                expect(tableBodyMatch[1]).not.toContain('json-cell');
            }
        });

        it('should include JSON modal HTML elements', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id'],
                rows: [[1]],
                columnTypes: ['other'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            expect(html).toContain('jsonModalOverlay');
            expect(html).toContain('jsonModalTitle');
            expect(html).toContain('jsonModalContent');
        });
    });

    describe('PostgreSQL JSON/JSONB column rendering', () => {
        it('should include columnTypes for PostgreSQL JSONB columns', async () => {
            mockConnectionManager.getConnection.mockReturnValue({
                id: 'conn-1',
                name: 'Test PG',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
            });

            const pgClient = new PostgresClient();
            (pgClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'payload'],
                rows: [[1, '{"nested":{"deep":true}}']],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(pgClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'events',
                'public'
            );

            const html = await waitForHtml();
            expect(html).toContain('"columnTypes":["other","json"]');
            expect(html).toContain('json-cell');
        });
    });

    describe('Query execution with columnTypes', () => {
        it('should pass columnTypes in queryResults postMessage for MySQL', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id'],
                rows: [[1]],
                columnTypes: ['other'],
            } as QueryResult);
            (mysqlClient as any).executeQuery = jest.fn().mockResolvedValue({
                columns: ['id', 'config'],
                rows: [[1, '{"key":"val"}']],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'SELECT id, config FROM settings',
            });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'queryResults',
                    columns: ['id', 'config'],
                    rows: [[1, '{"key":"val"}']],
                    columnTypes: ['other', 'json'],
                })
            );
        });

        it('should pass empty columnTypes array when result has no columnTypes', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id'],
                rows: [[1]],
            } as QueryResult);
            (mysqlClient as any).executeQuery = jest.fn().mockResolvedValue({
                columns: ['affectedRows'],
                rows: [[5]],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'DELETE FROM users WHERE id > 10',
            });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'queryResults',
                    columnTypes: [],
                })
            );
        });

        it('should pass columnTypes in queryResults for PostgreSQL executeQuery', async () => {
            mockConnectionManager.getConnection.mockReturnValue({
                id: 'conn-1',
                name: 'Test PG',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
            });

            const pgClient = new PostgresClient();
            (pgClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id'],
                rows: [[1]],
                columnTypes: ['other'],
            } as QueryResult);
            (pgClient as any).executeQuery = jest.fn().mockResolvedValue({
                columns: ['id', 'data'],
                rows: [[1, '{"a":1}']],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(pgClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'test_table',
                'public'
            );

            await waitForHtml();
            await messageHandler({
                command: 'executeQuery',
                connectionId: 'conn-1',
                query: 'SELECT id, data FROM test_table',
                schema: 'public',
            });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'queryResults',
                    columnTypes: ['other', 'json'],
                })
            );
        });
    });

    describe('columnTypes with no data', () => {
        it('should handle empty rows with columnTypes', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'name'],
                rows: [],
                columnTypes: ['other', 'other'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'empty_table'
            );

            const html = await waitForHtml();
            expect(html).toContain('"columnTypes":["other","other"]');
        });

        it('should default to empty array when columnTypes is undefined', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id'],
                rows: [[1]],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            expect(html).toContain('"columnTypes":[]');
        });
    });

    describe('JSON cell HTML escaping', () => {
        it('should HTML-escape JSON content in cells to prevent XSS', async () => {
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'data'],
                rows: [[1, '{"html":"<script>alert(1)</script>"}']],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            // The raw <script> tag should be escaped in the table cell
            expect(html).not.toContain('"html":"<script>alert(1)</script>"');
            expect(html).toContain('&lt;script&gt;');
        });
    });

    describe('JSON cell truncation', () => {
        it('should truncate long JSON values in cells', async () => {
            const longJson = '{"key":"' + 'x'.repeat(200) + '"}';
            const mysqlClient = new MySQLClient();
            (mysqlClient as any).getTableData = jest.fn().mockResolvedValue({
                columns: ['id', 'data'],
                rows: [[1, longJson]],
                columnTypes: ['other', 'json'],
            } as QueryResult);

            mockDatabaseManager.getClient.mockReturnValue(mysqlClient);

            DataViewerPanel.createOrShow(
                { fsPath: '/mock' } as any,
                mockDatabaseManager,
                mockConnectionManager,
                'conn-1',
                'users'
            );

            const html = await waitForHtml();
            // Should contain truncation ellipsis in the table body
            const tableBodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
            expect(tableBodyMatch).toBeTruthy();
            if (tableBodyMatch) {
                expect(tableBodyMatch[1]).toContain('...');
                // Should not contain the full 200-char string
                expect(tableBodyMatch[1]).not.toContain('x'.repeat(200));
            }
        });
    });
});
