import { ConnectionFormPanel } from '../connectionFormPanel';

// Track handlers captured during panel creation
let capturedMessageHandler: ((message: any) => Promise<void>) | null = null;
let capturedDisposeHandler: (() => void) | null = null;

const mockPostMessage = jest.fn();
const mockPanelDispose = jest.fn();

// Mock vscode - use factory functions that reference module-level variables
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn().mockImplementation(() => ({
            webview: {
                html: '',
                onDidReceiveMessage: (handler: any) => {
                    capturedMessageHandler = handler;
                    return { dispose: jest.fn() };
                },
                postMessage: (...args: any[]) => mockPostMessage(...args),
            },
            onDidDispose: (handler: any) => {
                capturedDisposeHandler = handler;
                return { dispose: jest.fn() };
            },
            dispose: (...args: any[]) => mockPanelDispose(...args),
            reveal: jest.fn(),
        })),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
    },
    ViewColumn: { Active: 1, One: 1, Two: 2 },
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        joinPath: (base: any, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        }),
    },
}));

// Mock fs and path
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue('<html><meta http-equiv="Content-Security-Policy" content=""><script src="__SCRIPT_URI__"></script></html>'),
}));

jest.mock('path', () => ({
    join: (...args: string[]) => args.join('/'),
}));

// Mock database clients
jest.mock('../clients/redisClient', () => ({ RedisClient: jest.fn() }));
jest.mock('../clients/mysqlClient', () => ({ MySQLClient: jest.fn() }));
jest.mock('../clients/postgresClient', () => ({ PostgresClient: jest.fn() }));
jest.mock('../clients/mongoClient', () => ({ MongoDBClient: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require('vscode');

describe('ConnectionFormPanel', () => {
    let mockConnectionManager: any;
    let mockDatabaseManager: any;
    let mockTreeRefreshCallback: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        capturedMessageHandler = null;
        capturedDisposeHandler = null;
        ConnectionFormPanel.currentPanel = undefined;

        mockConnectionManager = {
            addConnection: jest.fn().mockResolvedValue(undefined),
            updateConnection: jest.fn().mockResolvedValue(undefined),
        };

        mockDatabaseManager = {
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
        };

        mockTreeRefreshCallback = jest.fn();
    });

    describe('createOrShow', () => {
        it('should create a new panel for adding connection', () => {
            ConnectionFormPanel.createOrShow(
                { fsPath: '/mock/extension' } as any,
                mockConnectionManager,
                mockDatabaseManager,
                mockTreeRefreshCallback
            );

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'connectionForm',
                'Add Connection',
                expect.any(Number),
                expect.objectContaining({
                    enableScripts: true,
                    retainContextWhenHidden: true,
                })
            );
            expect(ConnectionFormPanel.currentPanel).toBeDefined();
        });

        it('should create a panel with edit title for existing config', () => {
            ConnectionFormPanel.createOrShow(
                { fsPath: '/mock/extension' } as any,
                mockConnectionManager,
                mockDatabaseManager,
                mockTreeRefreshCallback,
                {
                    id: 'conn-1',
                    name: 'Test MySQL',
                    type: 'mysql',
                    host: 'localhost',
                    port: 3306,
                }
            );

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'connectionForm',
                'Edit Connection: Test MySQL',
                expect.any(Number),
                expect.any(Object)
            );
        });

        it('should dispose existing panel before creating new one', () => {
            ConnectionFormPanel.createOrShow(
                { fsPath: '/mock/extension' } as any,
                mockConnectionManager,
                mockDatabaseManager,
                mockTreeRefreshCallback
            );

            // Create second panel - should dispose first
            ConnectionFormPanel.createOrShow(
                { fsPath: '/mock/extension' } as any,
                mockConnectionManager,
                mockDatabaseManager,
                mockTreeRefreshCallback
            );

            expect(mockPanelDispose).toHaveBeenCalled();
        });
    });

    describe('message handling', () => {
        beforeEach(() => {
            ConnectionFormPanel.createOrShow(
                { fsPath: '/mock/extension' } as any,
                mockConnectionManager,
                mockDatabaseManager,
                mockTreeRefreshCallback
            );
        });

        describe('save command - add mode', () => {
            it('should add a new connection and refresh tree', async () => {
                await capturedMessageHandler!({
                    command: 'save',
                    data: {
                        name: 'New MySQL',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                        username: 'root',
                        password: 'pass',
                        database: 'testdb',
                        updateProtection: false,
                    },
                });

                expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'New MySQL',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    })
                );
                expect(mockTreeRefreshCallback).toHaveBeenCalled();
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                    expect.stringContaining('added successfully')
                );
            });

            it('should use existing id when provided', async () => {
                await capturedMessageHandler!({
                    command: 'save',
                    data: {
                        id: 'custom-id',
                        name: 'Test',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    },
                });

                expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(
                    expect.objectContaining({ id: 'custom-id' })
                );
            });

            it('should generate id when not provided', async () => {
                await capturedMessageHandler!({
                    command: 'save',
                    data: {
                        name: 'Test',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    },
                });

                const calledConfig = mockConnectionManager.addConnection.mock.calls[0][0];
                expect(calledConfig.id).toBeDefined();
                expect(calledConfig.id).not.toBe('');
            });
        });

        describe('save command - edit mode', () => {
            it('should update connection when in edit mode', async () => {
                // Create panel in edit mode
                ConnectionFormPanel.currentPanel = undefined;
                ConnectionFormPanel.createOrShow(
                    { fsPath: '/mock/extension' } as any,
                    mockConnectionManager,
                    mockDatabaseManager,
                    mockTreeRefreshCallback,
                    {
                        id: 'conn-1',
                        name: 'Old Name',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    }
                );

                await capturedMessageHandler!({
                    command: 'save',
                    data: {
                        id: 'conn-1',
                        name: 'New Name',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    },
                });

                expect(mockConnectionManager.updateConnection).toHaveBeenCalledWith(
                    expect.objectContaining({ id: 'conn-1', name: 'New Name' })
                );
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                    expect.stringContaining('updated successfully')
                );
            });
        });

        describe('save command - error handling', () => {
            it('should send error message to webview on save failure', async () => {
                mockConnectionManager.addConnection.mockRejectedValueOnce(new Error('Storage full'));

                await capturedMessageHandler!({
                    command: 'save',
                    data: {
                        name: 'Test',
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    },
                });

                expect(mockPostMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        command: 'saveResult',
                        success: false,
                    })
                );
            });
        });

        describe('testConnection command', () => {
            it('should test connection and send success', async () => {
                await capturedMessageHandler!({
                    command: 'testConnection',
                    data: {
                        name: 'Test',
                        type: 'postgresql',
                        host: 'localhost',
                        port: 5432,
                        username: 'postgres',
                        password: 'pass',
                        database: 'testdb',
                    },
                });

                expect(mockDatabaseManager.connect).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'postgresql',
                        host: 'localhost',
                    })
                );
                expect(mockDatabaseManager.disconnect).toHaveBeenCalled();
                expect(mockPostMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        command: 'testResult',
                        success: true,
                    })
                );
            });

            it('should send failure when test connection fails', async () => {
                mockDatabaseManager.connect.mockRejectedValueOnce(new Error('Connection refused'));

                await capturedMessageHandler!({
                    command: 'testConnection',
                    data: {
                        type: 'mysql',
                        host: 'badhost',
                        port: 3306,
                    },
                });

                expect(mockPostMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        command: 'testResult',
                        success: false,
                        error: expect.stringContaining('Connection refused'),
                    })
                );
            });

            it('should use temp id with __test_ prefix', async () => {
                await capturedMessageHandler!({
                    command: 'testConnection',
                    data: {
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                    },
                });

                const config = mockDatabaseManager.connect.mock.calls[0][0];
                expect(config.id).toMatch(/^__test_/);
            });
        });

        describe('cancel command', () => {
            it('should dispose the panel', async () => {
                await capturedMessageHandler!({ command: 'cancel' });

                expect(mockPanelDispose).toHaveBeenCalled();
                expect(ConnectionFormPanel.currentPanel).toBeUndefined();
            });
        });
    });

    describe('dispose', () => {
        it('should clear currentPanel on dispose', () => {
            ConnectionFormPanel.createOrShow(
                { fsPath: '/mock/extension' } as any,
                mockConnectionManager,
                mockDatabaseManager,
                mockTreeRefreshCallback
            );

            expect(ConnectionFormPanel.currentPanel).toBeDefined();

            // Trigger the onDidDispose handler
            capturedDisposeHandler!();

            expect(ConnectionFormPanel.currentPanel).toBeUndefined();
        });
    });
});
