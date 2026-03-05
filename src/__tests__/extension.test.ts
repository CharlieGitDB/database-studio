// Mock all dependencies before any imports

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnectAll = jest.fn().mockResolvedValue(undefined);
const mockGetClient = jest.fn();

jest.mock('../databaseManager', () => ({
    DatabaseManager: jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        disconnect: mockDisconnect,
        disconnectAll: mockDisconnectAll,
        getClient: mockGetClient,
    })),
}));

const mockAddConnection = jest.fn().mockResolvedValue(undefined);
const mockDeleteConnection = jest.fn().mockResolvedValue(undefined);
const mockGetConnection = jest.fn();
const mockGetAllConnections = jest.fn().mockReturnValue([]);

jest.mock('../connectionManager', () => ({
    ConnectionManager: jest.fn().mockImplementation(() => ({
        addConnection: mockAddConnection,
        deleteConnection: mockDeleteConnection,
        getConnection: mockGetConnection,
        getAllConnections: mockGetAllConnections,
    })),
}));

const mockRefresh = jest.fn();
const mockSetConnectionStatus = jest.fn();

jest.mock('../treeDataProvider', () => ({
    DatabaseTreeDataProvider: jest.fn().mockImplementation(() => ({
        refresh: mockRefresh,
        setConnectionStatus: mockSetConnectionStatus,
        onDidChangeTreeData: jest.fn(),
    })),
    DatabaseTreeItem: jest.fn(),
}));

jest.mock('../webviewProvider', () => ({
    DataViewerPanel: {
        createOrShow: jest.fn(),
    },
}));

jest.mock('../connectionFormPanel', () => ({
    ConnectionFormPanel: {
        createOrShow: jest.fn(),
    },
}));

const mockRegisterCommand = jest.fn();
const mockExecuteCommand = jest.fn();
const mockShowInformationMessage = jest.fn().mockResolvedValue(undefined);
const mockShowErrorMessage = jest.fn().mockResolvedValue(undefined);
const mockShowWarningMessage = jest.fn().mockResolvedValue(undefined);
const mockOnDidExpandElement = jest.fn().mockReturnValue({ dispose: jest.fn() });
const mockCreateTreeView = jest.fn().mockReturnValue({
    onDidExpandElement: mockOnDidExpandElement,
    dispose: jest.fn(),
});

jest.mock('vscode', () => ({
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: jest.fn().mockImplementation((id: string) => ({ id })),
    TreeItem: jest.fn(),
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn(),
    })),
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        joinPath: (base: any, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        }),
    },
    window: {
        showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
        showErrorMessage: (...args: any[]) => mockShowErrorMessage(...args),
        showWarningMessage: (...args: any[]) => mockShowWarningMessage(...args),
        createTreeView: (...args: any[]) => mockCreateTreeView(...args),
        createWebviewPanel: jest.fn(),
    },
    commands: {
        registerCommand: (...args: any[]) => mockRegisterCommand(...args),
        executeCommand: (...args: any[]) => mockExecuteCommand(...args),
    },
    ViewColumn: { One: 1, Two: 2, Three: 3 },
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({ get: jest.fn(), update: jest.fn() }),
    },
}));

import { activate, deactivate } from '../extension';

describe('Extension', () => {
    let context: any;
    let registeredCommands: Record<string, Function>;

    beforeEach(() => {
        jest.clearAllMocks();
        registeredCommands = {};

        mockRegisterCommand.mockImplementation(
            (name: string, handler: Function) => {
                registeredCommands[name] = handler;
                return { dispose: jest.fn() };
            }
        );

        context = {
            subscriptions: [],
            globalState: {
                get: jest.fn().mockReturnValue([]),
                update: jest.fn().mockResolvedValue(undefined),
            },
            extensionUri: { fsPath: '/mock/extension' },
            extensionPath: '/mock/extension',
        };
    });

    describe('activate', () => {
        it('should register all commands', () => {
            activate(context);

            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.addConnection', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.refreshConnections', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.editConnection', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.deleteConnection', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.connect', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.disconnect', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('dbClient.viewData', expect.any(Function));
        });

        it('should create tree view', () => {
            activate(context);

            expect(mockCreateTreeView).toHaveBeenCalledWith('dbClientExplorer', {
                treeDataProvider: expect.any(Object),
            });
        });

        it('should add subscriptions to context', () => {
            activate(context);

            // 7 commands + treeView + cleanup disposable = at minimum 9
            expect(context.subscriptions.length).toBeGreaterThanOrEqual(9);
        });
    });

    describe('refreshConnections command', () => {
        it('should call treeDataProvider.refresh()', () => {
            activate(context);
            registeredCommands['dbClient.refreshConnections']();

            expect(mockRefresh).toHaveBeenCalled();
        });
    });

    describe('connect command', () => {
        it('should connect and set connection status', async () => {
            activate(context);
            mockGetConnection.mockReturnValue({
                id: 'conn-1',
                name: 'Test',
                type: 'mysql',
                host: 'localhost',
                port: 3306,
            });

            await registeredCommands['dbClient.connect']({
                connectionId: 'conn-1',
            });

            expect(mockConnect).toHaveBeenCalled();
            expect(mockSetConnectionStatus).toHaveBeenCalledWith('conn-1', true);
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Connected to Test');
        });

        it('should show error when connection not found', async () => {
            activate(context);
            mockGetConnection.mockReturnValue(undefined);

            await registeredCommands['dbClient.connect']({ connectionId: 'conn-1' });

            expect(mockShowErrorMessage).toHaveBeenCalledWith('Connection not found');
        });

        it('should show error on connection failure', async () => {
            activate(context);
            mockGetConnection.mockReturnValue({
                id: 'conn-1',
                name: 'Test',
                type: 'mysql',
                host: 'localhost',
                port: 3306,
            });
            mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

            await registeredCommands['dbClient.connect']({ connectionId: 'conn-1' });

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to connect')
            );
        });

        it('should do nothing without item', async () => {
            activate(context);
            await registeredCommands['dbClient.connect'](null);

            expect(mockConnect).not.toHaveBeenCalled();
        });
    });

    describe('disconnect command', () => {
        it('should disconnect and update status', async () => {
            activate(context);
            mockGetConnection.mockReturnValue({ id: 'conn-1', name: 'Test' });

            await registeredCommands['dbClient.disconnect']({
                connectionId: 'conn-1',
            });

            expect(mockDisconnect).toHaveBeenCalledWith('conn-1');
            expect(mockSetConnectionStatus).toHaveBeenCalledWith('conn-1', false);
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Disconnected from Test');
        });

        it('should show error on disconnect failure', async () => {
            activate(context);
            mockDisconnect.mockRejectedValueOnce(new Error('Timeout'));

            await registeredCommands['dbClient.disconnect']({
                connectionId: 'conn-1',
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to disconnect')
            );
        });
    });

    describe('deleteConnection command', () => {
        it('should delete when user confirms', async () => {
            activate(context);
            mockShowWarningMessage.mockResolvedValue('Yes');

            await registeredCommands['dbClient.deleteConnection']({
                connectionId: 'conn-1',
                label: 'Test MySQL',
            });

            expect(mockDisconnect).toHaveBeenCalledWith('conn-1');
            expect(mockDeleteConnection).toHaveBeenCalledWith('conn-1');
            expect(mockRefresh).toHaveBeenCalled();
        });

        it('should not delete when user cancels', async () => {
            activate(context);
            mockShowWarningMessage.mockResolvedValue('No');

            await registeredCommands['dbClient.deleteConnection']({
                connectionId: 'conn-1',
                label: 'Test MySQL',
            });

            expect(mockDeleteConnection).not.toHaveBeenCalled();
        });
    });

    describe('editConnection command', () => {
        it('should disconnect if currently connected before editing', async () => {
            activate(context);
            mockGetConnection.mockReturnValue({
                id: 'conn-1',
                name: 'Test',
                type: 'mysql',
                host: 'localhost',
                port: 3306,
            });
            mockGetClient.mockReturnValue({}); // client exists = connected

            await registeredCommands['dbClient.editConnection']({
                connectionId: 'conn-1',
            });

            expect(mockDisconnect).toHaveBeenCalledWith('conn-1');
            expect(mockSetConnectionStatus).toHaveBeenCalledWith('conn-1', false);
        });

        it('should show error when config not found', async () => {
            activate(context);
            mockGetConnection.mockReturnValue(undefined);

            await registeredCommands['dbClient.editConnection']({
                connectionId: 'conn-1',
            });

            expect(mockShowErrorMessage).toHaveBeenCalledWith('Connection not found');
        });
    });

    describe('deactivate', () => {
        it('should be a function that can be called', () => {
            expect(deactivate).toBeInstanceOf(Function);
            deactivate();
        });
    });
});
