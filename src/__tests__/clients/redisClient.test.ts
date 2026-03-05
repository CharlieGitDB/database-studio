import { RedisClient } from '../../clients/redisClient';
import { ConnectionConfig } from '../../types';

// Mock ioredis
const mockRedisInstance = {
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn(),
    type: jest.fn(),
    ttl: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    lrange: jest.fn(),
    rpush: jest.fn(),
    smembers: jest.fn(),
    sadd: jest.fn(),
    zrange: jest.fn(),
    hgetall: jest.fn(),
    hset: jest.fn(),
    zadd: jest.fn(),
    del: jest.fn(),
    status: 'ready',
};

jest.mock('ioredis', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => mockRedisInstance),
    };
});

describe('RedisClient', () => {
    let client: RedisClient;
    const mockConfig: ConnectionConfig = {
        id: 'test-redis',
        name: 'Test Redis',
        type: 'redis',
        host: 'localhost',
        port: 6379,
        password: 'password',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        client = new RedisClient();
        mockRedisInstance.status = 'ready';
    });

    describe('connect', () => {
        it('should create Redis client with correct config and connect', async () => {
            const Redis = require('ioredis').default;
            await client.connect(mockConfig);

            expect(Redis).toHaveBeenCalledWith({
                host: 'localhost',
                port: 6379,
                password: 'password',
                lazyConnect: true,
            });
            expect(mockRedisInstance.connect).toHaveBeenCalled();
        });
    });

    describe('disconnect', () => {
        it('should quit the connection', async () => {
            await client.connect(mockConfig);
            await client.disconnect();

            expect(mockRedisInstance.quit).toHaveBeenCalled();
        });

        it('should do nothing if not connected', async () => {
            await client.disconnect();
            expect(mockRedisInstance.quit).not.toHaveBeenCalled();
        });
    });

    describe('isConnected', () => {
        it('should return false when not connected', () => {
            expect(client.isConnected()).toBe(false);
        });

        it('should return true when connected and ready', async () => {
            await client.connect(mockConfig);
            expect(client.isConnected()).toBe(true);
        });
    });

    describe('getKeys', () => {
        it('should return key info with type and ttl', async () => {
            await client.connect(mockConfig);
            mockRedisInstance.keys.mockResolvedValue(['key1', 'key2', 'key3']);
            mockRedisInstance.type
                .mockResolvedValueOnce('string')
                .mockResolvedValueOnce('list')
                .mockResolvedValueOnce('hash');
            mockRedisInstance.ttl
                .mockResolvedValueOnce(-1)
                .mockResolvedValueOnce(300)
                .mockResolvedValueOnce(600);

            const keys = await client.getKeys();
            expect(keys).toEqual([
                { key: 'key1', type: 'string', ttl: -1 },
                { key: 'key2', type: 'list', ttl: 300 },
                { key: 'key3', type: 'hash', ttl: 600 },
            ]);
        });

        it('should respect custom pattern and limit', async () => {
            await client.connect(mockConfig);
            mockRedisInstance.keys.mockResolvedValue(['user:1', 'user:2', 'user:3']);
            mockRedisInstance.type.mockResolvedValue('string');
            mockRedisInstance.ttl.mockResolvedValue(-1);

            const keys = await client.getKeys('user:*', 2);
            expect(keys).toHaveLength(2);
            expect(mockRedisInstance.keys).toHaveBeenCalledWith('user:*');
        });

        it('should throw if not connected', async () => {
            await expect(client.getKeys()).rejects.toThrow('Not connected');
        });
    });

    describe('getValue', () => {
        beforeEach(async () => {
            await client.connect(mockConfig);
        });

        it('should get string value', async () => {
            mockRedisInstance.type.mockResolvedValue('string');
            mockRedisInstance.get.mockResolvedValue('hello');

            const result = await client.getValue('mykey');
            expect(result).toEqual({
                columns: ['Key', 'Type', 'Value'],
                rows: [['mykey', 'string', JSON.stringify('hello', null, 2)]],
            });
        });

        it('should get list value', async () => {
            mockRedisInstance.type.mockResolvedValue('list');
            mockRedisInstance.lrange.mockResolvedValue(['a', 'b', 'c']);

            const result = await client.getValue('mylist');
            expect(result.rows[0][1]).toBe('list');
            expect(JSON.parse(result.rows[0][2])).toEqual(['a', 'b', 'c']);
        });

        it('should get set value', async () => {
            mockRedisInstance.type.mockResolvedValue('set');
            mockRedisInstance.smembers.mockResolvedValue(['a', 'b']);

            const result = await client.getValue('myset');
            expect(result.rows[0][1]).toBe('set');
        });

        it('should get zset value', async () => {
            mockRedisInstance.type.mockResolvedValue('zset');
            mockRedisInstance.zrange.mockResolvedValue(['a', '1', 'b', '2']);

            const result = await client.getValue('myzset');
            expect(result.rows[0][1]).toBe('zset');
            expect(mockRedisInstance.zrange).toHaveBeenCalledWith('myzset', 0, -1, 'WITHSCORES');
        });

        it('should get hash value', async () => {
            mockRedisInstance.type.mockResolvedValue('hash');
            mockRedisInstance.hgetall.mockResolvedValue({ field1: 'val1', field2: 'val2' });

            const result = await client.getValue('myhash');
            expect(result.rows[0][1]).toBe('hash');
        });

        it('should handle unknown type', async () => {
            mockRedisInstance.type.mockResolvedValue('stream');

            const result = await client.getValue('mystream');
            expect(result.rows[0][2]).toContain('Unknown type');
        });

        it('should throw if not connected', async () => {
            const newClient = new RedisClient();
            await expect(newClient.getValue('key')).rejects.toThrow('Not connected');
        });
    });

    describe('setValue', () => {
        beforeEach(async () => {
            await client.connect(mockConfig);
        });

        it('should set string value', async () => {
            await client.setValue('mykey', 'hello');
            expect(mockRedisInstance.set).toHaveBeenCalledWith('mykey', 'hello');
        });

        it('should set hash value', async () => {
            const hashData = { field1: 'val1', field2: 'val2' };
            await client.setValue('myhash', JSON.stringify(hashData), 'hash');
            expect(mockRedisInstance.hset).toHaveBeenCalledWith('myhash', hashData);
        });

        it('should set list value', async () => {
            const listData = ['a', 'b', 'c'];
            await client.setValue('mylist', JSON.stringify(listData), 'list');
            expect(mockRedisInstance.del).toHaveBeenCalledWith('mylist');
            expect(mockRedisInstance.rpush).toHaveBeenCalledWith('mylist', 'a', 'b', 'c');
        });

        it('should set set value', async () => {
            const setData = ['x', 'y'];
            await client.setValue('myset', JSON.stringify(setData), 'set');
            expect(mockRedisInstance.del).toHaveBeenCalledWith('myset');
            expect(mockRedisInstance.sadd).toHaveBeenCalledWith('myset', 'x', 'y');
        });

        it('should set zset value', async () => {
            const zsetData = ['member1', '1', 'member2', '2'];
            await client.setValue('myzset', JSON.stringify(zsetData), 'zset');
            expect(mockRedisInstance.del).toHaveBeenCalledWith('myzset');
            expect(mockRedisInstance.zadd).toHaveBeenCalledWith('myzset', 1, 'member1');
            expect(mockRedisInstance.zadd).toHaveBeenCalledWith('myzset', 2, 'member2');
        });

        it('should throw for unsupported type', async () => {
            await expect(client.setValue('key', 'val', 'stream')).rejects.toThrow('Unsupported type: stream');
        });

        it('should not push if list data is not array', async () => {
            await client.setValue('mylist', JSON.stringify('notarray'), 'list');
            expect(mockRedisInstance.del).toHaveBeenCalledWith('mylist');
            expect(mockRedisInstance.rpush).not.toHaveBeenCalled();
        });

        it('should not add if set data is not array', async () => {
            await client.setValue('myset', JSON.stringify('notarray'), 'set');
            expect(mockRedisInstance.del).toHaveBeenCalledWith('myset');
            expect(mockRedisInstance.sadd).not.toHaveBeenCalled();
        });

        it('should throw if not connected', async () => {
            const newClient = new RedisClient();
            await expect(newClient.setValue('key', 'val')).rejects.toThrow('Not connected');
        });
    });

    describe('deleteKey', () => {
        it('should delete the key', async () => {
            await client.connect(mockConfig);
            await client.deleteKey('mykey');
            expect(mockRedisInstance.del).toHaveBeenCalledWith('mykey');
        });

        it('should throw if not connected', async () => {
            await expect(client.deleteKey('key')).rejects.toThrow('Not connected');
        });
    });
});
