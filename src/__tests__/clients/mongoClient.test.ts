import { MongoDBClient } from '../../clients/mongoClient';
import { ConnectionConfig } from '../../types';

// Mock mongodb
const mockToArray = jest.fn();
const mockLimit = jest.fn().mockReturnValue({ toArray: mockToArray });
const mockFind = jest.fn().mockReturnValue({ limit: mockLimit });
const mockFindOne = jest.fn();
const mockUpdateOne = jest.fn();
const mockDeleteOne = jest.fn();
const mockInsertOne = jest.fn();
const mockAggregate = jest.fn().mockReturnValue({ toArray: mockToArray });
const mockIndexes = jest.fn();
const mockCreateIndex = jest.fn();
const mockDropIndex = jest.fn();
const mockCollection = jest.fn().mockReturnValue({
    find: mockFind,
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
    insertOne: mockInsertOne,
    aggregate: mockAggregate,
    indexes: mockIndexes,
    createIndex: mockCreateIndex,
    dropIndex: mockDropIndex,
});

const mockListCollections = jest.fn().mockReturnValue({ toArray: jest.fn() });
const mockListDatabases = jest.fn();
const mockDb = jest.fn().mockReturnValue({
    collection: mockCollection,
    listCollections: mockListCollections,
    admin: jest.fn().mockReturnValue({
        listDatabases: mockListDatabases,
    }),
});

const mockMongoConnect = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn().mockResolvedValue(undefined);

jest.mock('mongodb', () => ({
    MongoClient: jest.fn().mockImplementation(() => ({
        connect: mockMongoConnect,
        close: mockClose,
        db: mockDb,
    })),
    ObjectId: jest.fn().mockImplementation((id: string) => ({
        toString: () => id || 'mock-object-id',
        _bsontype: 'ObjectId',
    })),
}));

describe('MongoDBClient', () => {
    let client: MongoDBClient;
    const mockConfig: ConnectionConfig = {
        id: 'test-mongo',
        name: 'Test MongoDB',
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        username: 'admin',
        password: 'password',
        database: 'testdb',
    };

    const mockConfigNoAuth: ConnectionConfig = {
        id: 'test-mongo-noauth',
        name: 'Test MongoDB No Auth',
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
    };

    const mockConfigNoDb: ConnectionConfig = {
        id: 'test-mongo-nodb',
        name: 'Test MongoDB No DB',
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        username: 'admin',
        password: 'password',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        client = new MongoDBClient();
        mockListCollections.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    });

    describe('connect', () => {
        it('should connect with auth credentials', async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { MongoClient } = require('mongodb');
            await client.connect(mockConfig);

            expect(MongoClient).toHaveBeenCalledWith('mongodb://admin:password@localhost:27017');
            expect(mockMongoConnect).toHaveBeenCalled();
            expect(mockDb).toHaveBeenCalledWith('testdb');
            expect(client.isConnected()).toBe(true);
        });

        it('should connect without auth credentials', async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { MongoClient } = require('mongodb');
            await client.connect(mockConfigNoAuth);

            expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017');
        });

        it('should not set db if no database provided', async () => {
            mockDb.mockClear();
            await client.connect(mockConfigNoDb);

            // db() should not be called when no database is provided
            expect(mockDb).not.toHaveBeenCalled();
        });
    });

    describe('disconnect', () => {
        it('should close the connection', async () => {
            await client.connect(mockConfig);
            await client.disconnect();

            expect(mockClose).toHaveBeenCalled();
            expect(client.isConnected()).toBe(false);
        });

        it('should do nothing if not connected', async () => {
            await client.disconnect();
            expect(mockClose).not.toHaveBeenCalled();
        });
    });

    describe('isConnected', () => {
        it('should return false when not connected', () => {
            expect(client.isConnected()).toBe(false);
        });

        it('should return true when connected', async () => {
            await client.connect(mockConfig);
            expect(client.isConnected()).toBe(true);
        });
    });

    describe('getDatabases', () => {
        it('should return database names', async () => {
            await client.connect(mockConfig);
            mockListDatabases.mockResolvedValue({
                databases: [{ name: 'db1' }, { name: 'db2' }],
            });

            const databases = await client.getDatabases();
            expect(databases).toEqual(['db1', 'db2']);
        });

        it('should throw if not connected', async () => {
            await expect(client.getDatabases()).rejects.toThrow('Not connected');
        });
    });

    describe('getCollections', () => {
        it('should return collection names from specific database', async () => {
            await client.connect(mockConfig);
            mockListCollections.mockReturnValue({
                toArray: jest.fn().mockResolvedValue([{ name: 'users' }, { name: 'orders' }]),
            });

            const collections = await client.getCollections('testdb');
            expect(collections).toEqual(['users', 'orders']);
            expect(mockDb).toHaveBeenCalledWith('testdb');
        });

        it('should use default db when no database name provided', async () => {
            await client.connect(mockConfig);
            mockListCollections.mockReturnValue({
                toArray: jest.fn().mockResolvedValue([{ name: 'users' }]),
            });

            const collections = await client.getCollections();
            expect(collections).toEqual(['users']);
        });

        it('should throw if not connected', async () => {
            await expect(client.getCollections()).rejects.toThrow('Not connected');
        });

        it('should throw if no database specified and no default', async () => {
            await client.connect(mockConfigNoDb);
            mockDb.mockReturnValueOnce(null);

            // Access without a database name and no default db set
            await expect(client.getCollections()).rejects.toThrow('No database specified');
        });
    });

    describe('getCollectionData', () => {
        it('should return documents as columns and rows', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([
                { _id: 'id1', name: 'Alice', age: 30 },
                { _id: 'id2', name: 'Bob', age: 25 },
            ]);

            const result = await client.getCollectionData('users', 'testdb');
            expect(result.columns).toContain('_id');
            expect(result.columns).toContain('name');
            expect(result.columns).toContain('age');
            expect(result.rows).toHaveLength(2);
        });

        it('should return empty result for no documents', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([]);

            const result = await client.getCollectionData('users', 'testdb');
            expect(result).toEqual({ columns: [], rows: [] });
        });

        it('should stringify object values', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([
                { _id: 'id1', metadata: { key: 'value' } },
            ]);

            const result = await client.getCollectionData('users', 'testdb');
            const metadataIdx = result.columns.indexOf('metadata');
            expect(result.rows[0][metadataIdx]).toBe('{"key":"value"}');
        });

        it('should throw if not connected', async () => {
            await expect(client.getCollectionData('users')).rejects.toThrow('Not connected');
        });

        it('should throw if no database specified', async () => {
            await client.connect(mockConfigNoDb);
            mockDb.mockReturnValueOnce(null);

            await expect(client.getCollectionData('users')).rejects.toThrow('No database specified');
        });
    });

    describe('updateDocument', () => {
        it('should update document with $set excluding _id', async () => {
            await client.connect(mockConfig);
            mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

            await client.updateDocument('users', 'abc123', { _id: 'abc123', name: 'Charlie' }, 'testdb');

            expect(mockUpdateOne).toHaveBeenCalledWith(
                { _id: expect.anything() },
                { $set: { name: 'Charlie' } }
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.updateDocument('users', 'id', {})).rejects.toThrow('Not connected');
        });
    });

    describe('deleteDocument', () => {
        it('should delete document by ObjectId', async () => {
            await client.connect(mockConfig);
            mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

            await client.deleteDocument('users', 'abc123', 'testdb');

            expect(mockDeleteOne).toHaveBeenCalledWith({ _id: expect.anything() });
        });

        it('should throw if not connected', async () => {
            await expect(client.deleteDocument('users', 'id')).rejects.toThrow('Not connected');
        });
    });

    describe('executeQuery', () => {
        it('should execute find with parsed query', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([{ _id: 'id1', name: 'Alice' }]);

            const result = await client.executeQuery('users', '{"name":"Alice"}', 'testdb');
            expect(mockFind).toHaveBeenCalledWith({ name: 'Alice' });
            expect(result.columns).toContain('name');
        });

        it('should return empty result for no matches', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([]);

            const result = await client.executeQuery('users', '{}', 'testdb');
            expect(result).toEqual({ columns: [], rows: [] });
        });

        it('should throw if not connected', async () => {
            await expect(client.executeQuery('users', '{}')).rejects.toThrow('Not connected');
        });
    });

    describe('insertDocument', () => {
        it('should insert document and return id', async () => {
            await client.connect(mockConfig);
            mockInsertOne.mockResolvedValue({ insertedId: { toString: () => 'new-id' } });

            const id = await client.insertDocument('users', { name: 'Dave' }, 'testdb');
            expect(id).toBe('new-id');
            expect(mockInsertOne).toHaveBeenCalledWith({ name: 'Dave' });
        });

        it('should throw if not connected', async () => {
            await expect(client.insertDocument('users', {})).rejects.toThrow('Not connected');
        });
    });

    describe('aggregate', () => {
        it('should run aggregation pipeline and return results', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([{ _id: 'group1', count: 5 }]);

            const result = await client.aggregate('users', [{ $group: { _id: '$type', count: { $sum: 1 } } }], 'testdb');
            expect(mockAggregate).toHaveBeenCalledWith([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
            expect(result.columns).toContain('_id');
            expect(result.columns).toContain('count');
        });

        it('should return empty result for no documents', async () => {
            await client.connect(mockConfig);
            mockToArray.mockResolvedValue([]);

            const result = await client.aggregate('users', [], 'testdb');
            expect(result).toEqual({ columns: [], rows: [] });
        });

        it('should throw if not connected', async () => {
            await expect(client.aggregate('users', [])).rejects.toThrow('Not connected');
        });
    });

    describe('getIndexes', () => {
        it('should return indexes', async () => {
            await client.connect(mockConfig);
            const mockIndexList = [{ v: 2, key: { _id: 1 }, name: '_id_' }];
            mockIndexes.mockResolvedValue(mockIndexList);

            const indexes = await client.getIndexes('users', 'testdb');
            expect(indexes).toEqual(mockIndexList);
        });

        it('should throw if not connected', async () => {
            await expect(client.getIndexes('users')).rejects.toThrow('Not connected');
        });
    });

    describe('createIndex', () => {
        it('should create index and return name', async () => {
            await client.connect(mockConfig);
            mockCreateIndex.mockResolvedValue('name_1');

            const indexName = await client.createIndex('users', { name: 1 }, { unique: true }, 'testdb');
            expect(indexName).toBe('name_1');
            expect(mockCreateIndex).toHaveBeenCalledWith({ name: 1 }, { unique: true });
        });

        it('should throw if not connected', async () => {
            await expect(client.createIndex('users', { name: 1 })).rejects.toThrow('Not connected');
        });
    });

    describe('dropIndex', () => {
        it('should drop index by name', async () => {
            await client.connect(mockConfig);
            await client.dropIndex('users', 'name_1', 'testdb');
            expect(mockDropIndex).toHaveBeenCalledWith('name_1');
        });

        it('should throw if not connected', async () => {
            await expect(client.dropIndex('users', 'name_1')).rejects.toThrow('Not connected');
        });
    });

    describe('getDocumentById', () => {
        it('should find document by ObjectId', async () => {
            await client.connect(mockConfig);
            const mockDoc = { _id: 'abc123', name: 'Alice' };
            mockFindOne.mockResolvedValue(mockDoc);

            const doc = await client.getDocumentById('users', 'abc123', 'testdb');
            expect(doc).toEqual(mockDoc);
            expect(mockFindOne).toHaveBeenCalledWith({ _id: expect.anything() });
        });

        it('should throw if not connected', async () => {
            await expect(client.getDocumentById('users', 'id')).rejects.toThrow('Not connected');
        });
    });
});
