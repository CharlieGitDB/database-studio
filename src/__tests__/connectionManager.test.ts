import { ConnectionManager } from '../connectionManager';
import { ConnectionConfig } from '../types';

// Mock vscode
jest.mock('vscode', () => require('./__mocks__/vscode'));

describe('ConnectionManager', () => {
    let connectionManager: ConnectionManager;
    let mockContext: any;

    const testConnection: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'testdb',
    };

    const testConnection2: ConnectionConfig = {
        id: 'conn-2',
        name: 'Test Connection 2',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
    };

    beforeEach(() => {
        mockContext = {
            globalState: {
                get: jest.fn().mockReturnValue([]),
                update: jest.fn().mockResolvedValue(undefined),
            },
        };
        connectionManager = new ConnectionManager(mockContext);
    });

    describe('constructor', () => {
        it('should load saved connections on creation', () => {
            expect(mockContext.globalState.get).toHaveBeenCalledWith('connections', []);
        });

        it('should load existing connections from storage', () => {
            mockContext.globalState.get.mockReturnValue([testConnection, testConnection2]);
            const cm = new ConnectionManager(mockContext);

            expect(cm.getAllConnections()).toHaveLength(2);
            expect(cm.getConnection('conn-1')).toEqual(testConnection);
        });
    });

    describe('addConnection', () => {
        it('should add a new connection and persist it', async () => {
            await connectionManager.addConnection(testConnection);

            expect(connectionManager.getConnection('conn-1')).toEqual(testConnection);
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                'connections',
                [testConnection]
            );
        });

        it('should handle multiple connections', async () => {
            await connectionManager.addConnection(testConnection);
            await connectionManager.addConnection(testConnection2);

            expect(connectionManager.getAllConnections()).toHaveLength(2);
        });
    });

    describe('updateConnection', () => {
        it('should update an existing connection', async () => {
            await connectionManager.addConnection(testConnection);

            const updatedConfig = { ...testConnection, name: 'Updated Name' };
            await connectionManager.updateConnection(updatedConfig);

            expect(connectionManager.getConnection('conn-1')?.name).toBe('Updated Name');
            expect(mockContext.globalState.update).toHaveBeenCalled();
        });
    });

    describe('deleteConnection', () => {
        it('should remove the connection', async () => {
            await connectionManager.addConnection(testConnection);
            await connectionManager.deleteConnection('conn-1');

            expect(connectionManager.getConnection('conn-1')).toBeUndefined();
            expect(mockContext.globalState.update).toHaveBeenCalledWith('connections', []);
        });

        it('should handle deleting non-existent connection', async () => {
            await connectionManager.deleteConnection('nonexistent');
            expect(connectionManager.getAllConnections()).toHaveLength(0);
        });
    });

    describe('getConnection', () => {
        it('should return connection by id', async () => {
            await connectionManager.addConnection(testConnection);
            expect(connectionManager.getConnection('conn-1')).toEqual(testConnection);
        });

        it('should return undefined for non-existent id', () => {
            expect(connectionManager.getConnection('nonexistent')).toBeUndefined();
        });
    });

    describe('getAllConnections', () => {
        it('should return empty array when no connections', () => {
            expect(connectionManager.getAllConnections()).toEqual([]);
        });

        it('should return all connections', async () => {
            await connectionManager.addConnection(testConnection);
            await connectionManager.addConnection(testConnection2);

            const all = connectionManager.getAllConnections();
            expect(all).toHaveLength(2);
            expect(all).toContainEqual(testConnection);
            expect(all).toContainEqual(testConnection2);
        });
    });

    describe('getContext', () => {
        it('should return the extension context', () => {
            expect(connectionManager.getContext()).toBe(mockContext);
        });
    });
});
