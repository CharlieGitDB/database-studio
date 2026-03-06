import { DatabaseManager } from '../databaseManager';
import { ConnectionConfig } from '../types';

// Mock all clients using class-based mocks so instanceof checks work
const mockMySQLConnect = jest.fn().mockResolvedValue(undefined);
const mockMySQLDisconnect = jest.fn().mockResolvedValue(undefined);
const mockMySQLIsConnected = jest.fn().mockReturnValue(true);
const mockMySQLGetSchemaMap = jest.fn().mockResolvedValue({ users: ['id', 'name'] });

jest.mock('../clients/mysqlClient', () => {
    class MockMySQLClient {
        connect = mockMySQLConnect;
        disconnect = mockMySQLDisconnect;
        isConnected = mockMySQLIsConnected;
        getSchemaMap = mockMySQLGetSchemaMap;
    }
    return { MySQLClient: MockMySQLClient };
});

const mockPGConnect = jest.fn().mockResolvedValue(undefined);
const mockPGDisconnect = jest.fn().mockResolvedValue(undefined);
const mockPGIsConnected = jest.fn().mockReturnValue(true);
const mockPGGetSchemas = jest.fn().mockResolvedValue(['public', 'custom']);
const mockPGGetFullSchemaMap = jest.fn().mockResolvedValue({
    public: { users: ['id', 'name'] },
    custom: { logs: ['id'] },
});

jest.mock('../clients/postgresClient', () => {
    class MockPostgresClient {
        connect = mockPGConnect;
        disconnect = mockPGDisconnect;
        isConnected = mockPGIsConnected;
        getSchemas = mockPGGetSchemas;
        getFullSchemaMap = mockPGGetFullSchemaMap;
    }
    return { PostgresClient: MockPostgresClient };
});

const mockRedisConnect = jest.fn().mockResolvedValue(undefined);
const mockRedisDisconnect = jest.fn().mockResolvedValue(undefined);
const mockRedisIsConnected = jest.fn().mockReturnValue(true);

jest.mock('../clients/redisClient', () => {
    class MockRedisClient {
        connect = mockRedisConnect;
        disconnect = mockRedisDisconnect;
        isConnected = mockRedisIsConnected;
    }
    return { RedisClient: MockRedisClient };
});

const mockMongoConnect = jest.fn().mockResolvedValue(undefined);
const mockMongoDisconnect = jest.fn().mockResolvedValue(undefined);
const mockMongoIsConnected = jest.fn().mockReturnValue(true);

jest.mock('../clients/mongoClient', () => {
    class MockMongoDBClient {
        connect = mockMongoConnect;
        disconnect = mockMongoDisconnect;
        isConnected = mockMongoIsConnected;
    }
    return { MongoDBClient: MockMongoDBClient };
});

describe('DatabaseManager', () => {
    let manager: DatabaseManager;

    const mysqlConfig: ConnectionConfig = {
        id: 'mysql-1',
        name: 'MySQL',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
    };

    const pgConfig: ConnectionConfig = {
        id: 'pg-1',
        name: 'PostgreSQL',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
    };

    const redisConfig: ConnectionConfig = {
        id: 'redis-1',
        name: 'Redis',
        type: 'redis',
        host: 'localhost',
        port: 6379,
    };

    const mongoConfig: ConnectionConfig = {
        id: 'mongo-1',
        name: 'MongoDB',
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new DatabaseManager();
    });

    describe('connect', () => {
        it('should create and connect MySQL client', async () => {
            await manager.connect(mysqlConfig);

            expect(mockMySQLConnect).toHaveBeenCalledWith(mysqlConfig);
            expect(manager.getClient('mysql-1')).toBeDefined();
        });

        it('should create and connect PostgreSQL client', async () => {
            await manager.connect(pgConfig);

            expect(mockPGConnect).toHaveBeenCalledWith(pgConfig);
            expect(manager.getClient('pg-1')).toBeDefined();
        });

        it('should create and connect Redis client', async () => {
            await manager.connect(redisConfig);

            expect(mockRedisConnect).toHaveBeenCalledWith(redisConfig);
            expect(manager.getClient('redis-1')).toBeDefined();
        });

        it('should create and connect MongoDB client', async () => {
            await manager.connect(mongoConfig);

            expect(mockMongoConnect).toHaveBeenCalledWith(mongoConfig);
            expect(manager.getClient('mongo-1')).toBeDefined();
        });

        it('should throw for unsupported database type', async () => {
            const badConfig: ConnectionConfig = {
                id: 'bad',
                name: 'Bad',
                type: 'sqlite' as any,
                host: 'localhost',
                port: 0,
            };

            await expect(manager.connect(badConfig)).rejects.toThrow('Unsupported database type: sqlite');
        });
    });

    describe('disconnect', () => {
        it('should disconnect and remove client', async () => {
            await manager.connect(mysqlConfig);
            await manager.disconnect('mysql-1');

            expect(mockMySQLDisconnect).toHaveBeenCalled();
            expect(manager.getClient('mysql-1')).toBeUndefined();
        });

        it('should do nothing for non-existent connection', async () => {
            await manager.disconnect('nonexistent');
            // No error thrown
        });
    });

    describe('getClient', () => {
        it('should return client by id', async () => {
            await manager.connect(mysqlConfig);
            expect(manager.getClient('mysql-1')).toBeDefined();
        });

        it('should return undefined for non-existent id', () => {
            expect(manager.getClient('nonexistent')).toBeUndefined();
        });
    });

    describe('isConnected', () => {
        it('should return true when client exists and is connected', async () => {
            await manager.connect(mysqlConfig);
            expect(manager.isConnected('mysql-1')).toBe(true);
        });

        it('should return false for non-existent connection', () => {
            expect(manager.isConnected('nonexistent')).toBe(false);
        });
    });

    describe('disconnectAll', () => {
        it('should disconnect all clients', async () => {
            await manager.connect(mysqlConfig);
            await manager.connect(redisConfig);

            await manager.disconnectAll();

            expect(mockMySQLDisconnect).toHaveBeenCalled();
            expect(mockRedisDisconnect).toHaveBeenCalled();
            expect(manager.getClient('mysql-1')).toBeUndefined();
            expect(manager.getClient('redis-1')).toBeUndefined();
        });
    });

    describe('getSchemaInfo', () => {
        it('should return MySQL schema info', async () => {
            await manager.connect(mysqlConfig);
            const info = await manager.getSchemaInfo('mysql-1');

            expect(info.dbType).toBe('mysql');
            expect(info.tables).toEqual({ users: ['id', 'name'] });
        });

        it('should return PostgreSQL schema info', async () => {
            await manager.connect(pgConfig);
            const info = await manager.getSchemaInfo('pg-1');

            expect(info.dbType).toBe('postgresql');
            expect(info.schemas).toEqual(['public', 'custom']);
            expect(info.schemaTablesMap).toBeDefined();
            expect(info.tables).toEqual({ users: ['id', 'name'] });
        });

        it('should return PostgreSQL schema info for specific schema', async () => {
            await manager.connect(pgConfig);
            const info = await manager.getSchemaInfo('pg-1', 'custom');

            expect(info.tables).toEqual({ logs: ['id'] });
        });

        it('should return unknown for non-existent client', async () => {
            const info = await manager.getSchemaInfo('nonexistent');
            expect(info).toEqual({ dbType: 'unknown', tables: {} });
        });

        it('should return unknown for Redis client', async () => {
            await manager.connect(redisConfig);
            const info = await manager.getSchemaInfo('redis-1');

            expect(info).toEqual({ dbType: 'unknown', tables: {} });
        });

        it('should return unknown for MongoDB client', async () => {
            await manager.connect(mongoConfig);
            const info = await manager.getSchemaInfo('mongo-1');

            expect(info).toEqual({ dbType: 'unknown', tables: {} });
        });
    });
});
