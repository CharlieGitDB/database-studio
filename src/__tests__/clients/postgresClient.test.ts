import { PostgresClient } from '../../clients/postgresClient';
import { ConnectionConfig } from '../../types';

// Mock pg
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn();

jest.mock('pg', () => ({
    Client: jest.fn().mockImplementation(() => ({
        query: mockQuery,
        connect: mockConnect,
        end: mockEnd,
    })),
}));

describe('PostgresClient', () => {
    let client: PostgresClient;
    const mockConfig: ConnectionConfig = {
        id: 'test-pg',
        name: 'Test PostgreSQL',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        client = new PostgresClient();
    });

    describe('connect', () => {
        it('should create a pg client with correct config and connect', async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { Client } = require('pg');
            await client.connect(mockConfig);

            expect(Client).toHaveBeenCalledWith({
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: 'password',
                database: 'testdb',
            });
            expect(mockConnect).toHaveBeenCalled();
            expect(client.isConnected()).toBe(true);
        });
    });

    describe('disconnect', () => {
        it('should close the connection', async () => {
            await client.connect(mockConfig);
            await client.disconnect();

            expect(mockEnd).toHaveBeenCalled();
            expect(client.isConnected()).toBe(false);
        });

        it('should do nothing if not connected', async () => {
            await client.disconnect();
            expect(mockEnd).not.toHaveBeenCalled();
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

    describe('getSchemas', () => {
        it('should return list of schema names', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [{ schema_name: 'public' }, { schema_name: 'custom' }],
            });

            const schemas = await client.getSchemas();
            expect(schemas).toEqual(['public', 'custom']);
        });

        it('should throw if not connected', async () => {
            await expect(client.getSchemas()).rejects.toThrow('Not connected');
        });
    });

    describe('getTables', () => {
        it('should return table names for the given schema', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [{ table_name: 'users' }, { table_name: 'orders' }],
            });

            const tables = await client.getTables('public');
            expect(tables).toEqual(['users', 'orders']);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('table_schema = $1'),
                ['public']
            );
        });

        it('should default to public schema', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({ rows: [] });

            await client.getTables();
            expect(mockQuery).toHaveBeenCalledWith(
                expect.any(String),
                ['public']
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.getTables()).rejects.toThrow('Not connected');
        });
    });

    describe('getTableData', () => {
        it('should return columns and rows', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [{ name: 'id' }, { name: 'name' }],
                rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
            });

            const result = await client.getTableData('users');
            expect(result).toEqual({
                columns: ['id', 'name'],
                rows: [[1, 'Alice'], [2, 'Bob']],
                columnTypes: ['other', 'other'],
            });
        });

        it('should include schema in query when provided', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({ fields: [], rows: [] });

            await client.getTableData('users', 'custom', 50);
            expect(mockQuery).toHaveBeenCalledWith(
                'SELECT * FROM "custom"."users" LIMIT 50'
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.getTableData('users')).rejects.toThrow('Not connected');
        });
    });

    describe('updateRecord', () => {
        it('should execute UPDATE with parameterized query', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await client.updateRecord('users', 'id', 1, { name: 'Charlie', age: 30 });

            expect(mockQuery).toHaveBeenCalledWith(
                'UPDATE "users" SET "name" = $1, "age" = $2 WHERE "id" = $3',
                ['Charlie', 30, 1]
            );
        });

        it('should include schema when provided', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await client.updateRecord('users', 'id', 1, { name: 'X' }, 'custom');

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('"custom"."users"'),
                expect.any(Array)
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.updateRecord('users', 'id', 1, {})).rejects.toThrow('Not connected');
        });
    });

    describe('deleteRecord', () => {
        it('should execute DELETE with parameterized query', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await client.deleteRecord('users', 'id', 1);

            expect(mockQuery).toHaveBeenCalledWith(
                'DELETE FROM "users" WHERE "id" = $1',
                [1]
            );
        });

        it('should include schema when provided', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await client.deleteRecord('users', 'id', 1, 'custom');

            expect(mockQuery).toHaveBeenCalledWith(
                'DELETE FROM "custom"."users" WHERE "id" = $1',
                [1]
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.deleteRecord('users', 'id', 1)).rejects.toThrow('Not connected');
        });
    });

    describe('executeQuery', () => {
        it('should return columns and rows for SELECT', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [{ name: 'id' }, { name: 'name' }],
                rows: [{ id: 1, name: 'Alice' }],
            });

            const result = await client.executeQuery('SELECT * FROM users');
            expect(result).toEqual({
                columns: ['id', 'name'],
                rows: [[1, 'Alice']],
                columnTypes: ['other', 'other'],
            });
        });

        it('should return rowCount for non-SELECT queries', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [],
                rowCount: 3,
            });

            const result = await client.executeQuery('DELETE FROM users');
            expect(result).toEqual({
                columns: ['rowCount'],
                rows: [[3]],
            });
        });

        it('should return 0 when rowCount is null', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [],
                rowCount: null,
            });

            const result = await client.executeQuery('DELETE FROM users');
            expect(result).toEqual({
                columns: ['rowCount'],
                rows: [[0]],
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.executeQuery('SELECT 1')).rejects.toThrow('Not connected');
        });
    });

    describe('getColumns', () => {
        it('should return column info with foreign keys', async () => {
            await client.connect(mockConfig);
            mockQuery
                .mockResolvedValueOnce({
                    rows: [
                        { column_name: 'id', data_type: 'integer', is_nullable: 'NO', is_primary_key: true },
                        { column_name: 'user_id', data_type: 'integer', is_nullable: 'YES', is_primary_key: false },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { column_name: 'user_id', foreign_table_name: 'users', foreign_column_name: 'id' },
                    ],
                });

            const columns = await client.getColumns('orders');
            expect(columns).toHaveLength(2);
            expect(columns[0]).toEqual({
                name: 'id',
                type: 'integer',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
                referencedTable: undefined,
                referencedColumn: undefined,
            });
            expect(columns[1]).toEqual({
                name: 'user_id',
                type: 'integer',
                nullable: true,
                isPrimaryKey: false,
                isForeignKey: true,
                referencedTable: 'users',
                referencedColumn: 'id',
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.getColumns('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getConstraints', () => {
        it('should return parsed constraints', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [
                    {
                        constraint_name: 'users_pkey',
                        constraint_type: 'PRIMARY KEY',
                        columns: ['id'],
                        foreign_table: null,
                        foreign_columns: null,
                        check_clause: null,
                    },
                ],
            });

            const constraints = await client.getConstraints('users');
            expect(constraints).toHaveLength(1);
            expect(constraints[0].name).toBe('users_pkey');
            expect(constraints[0].type).toBe('PRIMARY KEY');
        });

        it('should throw if not connected', async () => {
            await expect(client.getConstraints('users')).rejects.toThrow('Not connected');
        });
    });

    describe('parseArrayColumn (via getConstraints)', () => {
        it('should handle null values', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [{
                    constraint_name: 'test',
                    constraint_type: 'CHECK',
                    columns: null,
                    foreign_table: null,
                    foreign_columns: null,
                    check_clause: 'age > 0',
                }],
            });

            const constraints = await client.getConstraints('users');
            expect(constraints[0].columns).toEqual([]);
        });

        it('should handle PostgreSQL array string format', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [{
                    constraint_name: 'test',
                    constraint_type: 'UNIQUE',
                    columns: '{col1,col2}',
                    foreign_table: null,
                    foreign_columns: null,
                    check_clause: null,
                }],
            });

            const constraints = await client.getConstraints('users');
            expect(constraints[0].columns).toEqual(['col1', 'col2']);
        });

        it('should handle empty PostgreSQL array string', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [{
                    constraint_name: 'test',
                    constraint_type: 'CHECK',
                    columns: '{}',
                    foreign_table: null,
                    foreign_columns: null,
                    check_clause: null,
                }],
            });

            const constraints = await client.getConstraints('users');
            expect(constraints[0].columns).toEqual([]);
        });

        it('should handle JavaScript arrays', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [{
                    constraint_name: 'test',
                    constraint_type: 'PRIMARY KEY',
                    columns: ['id', null, 'name'],
                    foreign_table: null,
                    foreign_columns: null,
                    check_clause: null,
                }],
            });

            const constraints = await client.getConstraints('users');
            expect(constraints[0].columns).toEqual(['id', 'name']);
        });
    });

    describe('getIndexes', () => {
        it('should return index list', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [
                    { index_name: 'users_pkey', columns: ['id'], is_unique: true, is_primary: true, index_type: 'btree' },
                ],
            });

            const indexes = await client.getIndexes('users');
            expect(indexes).toHaveLength(1);
            expect(indexes[0].name).toBe('users_pkey');
            expect(indexes[0].isPrimary).toBe(true);
        });

        it('should throw if not connected', async () => {
            await expect(client.getIndexes('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getRules', () => {
        it('should return rules', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [
                    { name: 'rule1', event: 'SELECT', definition: 'CREATE RULE ...' },
                ],
            });

            const rules = await client.getRules('users');
            expect(rules).toEqual([
                { name: 'rule1', event: 'SELECT', definition: 'CREATE RULE ...' },
            ]);
        });

        it('should throw if not connected', async () => {
            await expect(client.getRules('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getTriggers', () => {
        it('should return triggers', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [
                    { name: 'trg1', timing: 'BEFORE', event: 'INSERT', definition: 'CREATE TRIGGER ...' },
                ],
            });

            const triggers = await client.getTriggers('users');
            expect(triggers).toEqual([
                { name: 'trg1', timing: 'BEFORE', event: 'INSERT', definition: 'CREATE TRIGGER ...' },
            ]);
        });

        it('should throw if not connected', async () => {
            await expect(client.getTriggers('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getSchemaMap', () => {
        it('should return schema map grouped by table', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [
                    { table_name: 'users', column_name: 'id' },
                    { table_name: 'users', column_name: 'name' },
                    { table_name: 'orders', column_name: 'id' },
                ],
            });

            const schemaMap = await client.getSchemaMap('public');
            expect(schemaMap).toEqual({
                users: ['id', 'name'],
                orders: ['id'],
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.getSchemaMap()).rejects.toThrow('Not connected');
        });
    });

    describe('getFullSchemaMap', () => {
        it('should return full schema map grouped by schema and table', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                rows: [
                    { table_schema: 'public', table_name: 'users', column_name: 'id' },
                    { table_schema: 'public', table_name: 'users', column_name: 'name' },
                    { table_schema: 'custom', table_name: 'logs', column_name: 'id' },
                ],
            });

            const fullMap = await client.getFullSchemaMap();
            expect(fullMap).toEqual({
                public: {
                    users: ['id', 'name'],
                },
                custom: {
                    logs: ['id'],
                },
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.getFullSchemaMap()).rejects.toThrow('Not connected');
        });
    });

    describe('JSON/JSONB column type detection', () => {
        it('should detect JSON columns in getTableData (dataTypeID 114)', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [
                    { name: 'id', dataTypeID: 23 },     // INT4
                    { name: 'data', dataTypeID: 114 },   // JSON
                    { name: 'name', dataTypeID: 25 },    // TEXT
                ],
                rows: [{ id: 1, data: '{"key":"value"}', name: 'Alice' }],
            });

            const result = await client.getTableData('users');
            expect(result.columnTypes).toEqual(['other', 'json', 'other']);
        });

        it('should detect JSONB columns in getTableData (dataTypeID 3802)', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [
                    { name: 'id', dataTypeID: 23 },
                    { name: 'payload', dataTypeID: 3802 },  // JSONB
                ],
                rows: [{ id: 1, payload: '{"nested":true}' }],
            });

            const result = await client.getTableData('events');
            expect(result.columnTypes).toEqual(['other', 'json']);
        });

        it('should detect JSON columns in executeQuery', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [
                    { name: 'config', dataTypeID: 3802 },   // JSONB
                    { name: 'id', dataTypeID: 23 },          // INT4
                ],
                rows: [{ config: '{"setting":true}', id: 1 }],
            });

            const result = await client.executeQuery('SELECT config, id FROM settings');
            expect(result.columnTypes).toEqual(['json', 'other']);
            expect(result.columns).toEqual(['config', 'id']);
        });

        it('should mark all columns as other when no JSON columns exist', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [
                    { name: 'id', dataTypeID: 23 },
                    { name: 'name', dataTypeID: 25 },
                ],
                rows: [{ id: 1, name: 'Alice' }],
            });

            const result = await client.getTableData('users');
            expect(result.columnTypes).toEqual(['other', 'other']);
        });

        it('should handle mix of JSON and JSONB columns', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [
                    { name: 'meta_json', dataTypeID: 114 },    // JSON
                    { name: 'meta_jsonb', dataTypeID: 3802 },   // JSONB
                    { name: 'label', dataTypeID: 25 },          // TEXT
                ],
                rows: [{ meta_json: '{}', meta_jsonb: '{}', label: 'test' }],
            });

            const result = await client.getTableData('mixed');
            expect(result.columnTypes).toEqual(['json', 'json', 'other']);
        });

        it('should not include columnTypes for non-SELECT (rowCount) results', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue({
                fields: [],
                rowCount: 5,
            });

            const result = await client.executeQuery('DELETE FROM users');
            expect(result.columnTypes).toBeUndefined();
        });
    });
});
