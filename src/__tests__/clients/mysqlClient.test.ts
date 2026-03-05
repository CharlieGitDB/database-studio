import { MySQLClient } from '../../clients/mysqlClient';
import { ConnectionConfig } from '../../types';

// Mock mysql2/promise
const mockQuery = jest.fn();
const mockEnd = jest.fn();
const mockCreateConnection = jest.fn();

jest.mock('mysql2/promise', () => ({
    createConnection: (...args: any[]) => mockCreateConnection(...args),
}));

describe('MySQLClient', () => {
    let client: MySQLClient;
    const mockConfig: ConnectionConfig = {
        id: 'test-mysql',
        name: 'Test MySQL',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'testdb',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        client = new MySQLClient();
        mockCreateConnection.mockResolvedValue({
            query: mockQuery,
            end: mockEnd,
            config: { database: 'testdb' },
        });
    });

    describe('connect', () => {
        it('should create a MySQL connection with correct config', async () => {
            await client.connect(mockConfig);

            expect(mockCreateConnection).toHaveBeenCalledWith({
                host: 'localhost',
                port: 3306,
                user: 'root',
                password: 'password',
                database: 'testdb',
            });
            expect(client.isConnected()).toBe(true);
        });
    });

    describe('disconnect', () => {
        it('should close the connection and set to null', async () => {
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

    describe('getTables', () => {
        it('should return list of table names using INFORMATION_SCHEMA', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[
                { TABLE_NAME: 'orders' },
                { TABLE_NAME: 'users' },
            ]]);

            const tables = await client.getTables();
            expect(tables).toEqual(['orders', 'users']);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('INFORMATION_SCHEMA.TABLES'),
                ['testdb']
            );
        });

        it('should only return BASE TABLE types, not views', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[
                { TABLE_NAME: 'users' },
            ]]);

            await client.getTables();
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("TABLE_TYPE = 'BASE TABLE'"),
                expect.any(Array)
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.getTables()).rejects.toThrow('Not connected');
        });
    });

    describe('getTableData', () => {
        it('should return columns and rows', async () => {
            await client.connect(mockConfig);
            const mockFields = [{ name: 'id' }, { name: 'name' }];
            const mockRows = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ];
            mockQuery.mockResolvedValue([mockRows, mockFields]);

            const result = await client.getTableData('users');
            expect(result).toEqual({
                columns: ['id', 'name'],
                rows: [[1, 'Alice'], [2, 'Bob']],
                columnTypes: ['other', 'other'],
            });
        });

        it('should use custom limit', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[], []]);

            await client.getTableData('users', 50);
            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM `users` LIMIT 50');
        });

        it('should throw if not connected', async () => {
            await expect(client.getTableData('users')).rejects.toThrow('Not connected');
        });
    });

    describe('updateRecord', () => {
        it('should execute UPDATE query with correct parameters', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([{ affectedRows: 1 }]);

            await client.updateRecord('users', 'id', 1, { name: 'Charlie', age: 30 });

            expect(mockQuery).toHaveBeenCalledWith(
                'UPDATE `users` SET `name` = ?, `age` = ? WHERE `id` = ?',
                ['Charlie', 30, 1]
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.updateRecord('users', 'id', 1, { name: 'x' })).rejects.toThrow('Not connected');
        });
    });

    describe('deleteRecord', () => {
        it('should execute DELETE query with correct parameters', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([{ affectedRows: 1 }]);

            await client.deleteRecord('users', 'id', 1);

            expect(mockQuery).toHaveBeenCalledWith(
                'DELETE FROM `users` WHERE `id` = ?',
                [1]
            );
        });

        it('should throw if not connected', async () => {
            await expect(client.deleteRecord('users', 'id', 1)).rejects.toThrow('Not connected');
        });
    });

    describe('executeQuery', () => {
        it('should return columns and rows for SELECT queries', async () => {
            await client.connect(mockConfig);
            const mockFields = [{ name: 'id' }, { name: 'name' }];
            const mockRows = [{ id: 1, name: 'Alice' }];
            mockQuery.mockResolvedValue([mockRows, mockFields]);

            const result = await client.executeQuery('SELECT * FROM users');
            expect(result).toEqual({
                columns: ['id', 'name'],
                rows: [[1, 'Alice']],
                columnTypes: ['other', 'other'],
            });
        });

        it('should return affectedRows for non-SELECT queries', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([{ affectedRows: 5 }, undefined]);

            const result = await client.executeQuery('DELETE FROM users WHERE age > 50');
            expect(result).toEqual({
                columns: ['affectedRows'],
                rows: [[5]],
            });
        });

        it('should return 0 affectedRows when not available', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([{}, undefined]);

            const result = await client.executeQuery('DELETE FROM users');
            expect(result).toEqual({
                columns: ['affectedRows'],
                rows: [[0]],
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.executeQuery('SELECT 1')).rejects.toThrow('Not connected');
        });
    });

    describe('getColumns', () => {
        it('should return column info with foreign key mapping', async () => {
            await client.connect(mockConfig);

            // First call: column info
            mockQuery
                .mockResolvedValueOnce([[
                    { column_name: 'id', data_type: 'int', is_nullable: 'NO', column_key: 'PRI' },
                    { column_name: 'order_id', data_type: 'int', is_nullable: 'YES', column_key: 'MUL' },
                ]])
                // Second call: foreign key info
                .mockResolvedValueOnce([[
                    { column_name: 'order_id', referenced_table_name: 'orders', referenced_column_name: 'id' },
                ]]);

            const columns = await client.getColumns('users');
            expect(columns).toEqual([
                {
                    name: 'id',
                    type: 'int',
                    nullable: false,
                    isPrimaryKey: true,
                    isForeignKey: false,
                    referencedTable: undefined,
                    referencedColumn: undefined,
                },
                {
                    name: 'order_id',
                    type: 'int',
                    nullable: true,
                    isPrimaryKey: false,
                    isForeignKey: true,
                    referencedTable: 'orders',
                    referencedColumn: 'id',
                },
            ]);
        });

        it('should use provided database name', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[]]);

            await client.getColumns('users', 'customdb');
            expect(mockQuery.mock.calls[0][1]).toEqual(['customdb', 'users']);
        });

        it('should throw if not connected', async () => {
            await expect(client.getColumns('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getConstraints', () => {
        it('should return constraints with parsed columns', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[
                {
                    constraint_name: 'PRIMARY',
                    constraint_type: 'PRIMARY KEY',
                    columns: 'id',
                    referenced_table: null,
                    referenced_columns: null,
                    check_clause: null,
                },
                {
                    constraint_name: 'fk_order',
                    constraint_type: 'FOREIGN KEY',
                    columns: 'order_id',
                    referenced_table: 'orders',
                    referenced_columns: 'id',
                    check_clause: null,
                },
            ]]);

            const constraints = await client.getConstraints('users');
            expect(constraints).toHaveLength(2);
            expect(constraints[0]).toEqual({
                name: 'PRIMARY',
                type: 'PRIMARY KEY',
                columns: ['id'],
                definition: null,
                referencedTable: null,
                referencedColumns: undefined,
            });
            expect(constraints[1]).toEqual({
                name: 'fk_order',
                type: 'FOREIGN KEY',
                columns: ['order_id'],
                definition: null,
                referencedTable: 'orders',
                referencedColumns: ['id'],
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.getConstraints('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getIndexes', () => {
        it('should return grouped indexes', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[
                { Key_name: 'PRIMARY', Non_unique: 0, Column_name: 'id', Index_type: 'BTREE' },
                { Key_name: 'idx_name', Non_unique: 1, Column_name: 'first_name', Index_type: 'BTREE' },
                { Key_name: 'idx_name', Non_unique: 1, Column_name: 'last_name', Index_type: 'BTREE' },
            ]]);

            const indexes = await client.getIndexes('users');
            expect(indexes).toHaveLength(2);
            expect(indexes[0]).toEqual({
                name: 'PRIMARY',
                columns: ['id'],
                isUnique: true,
                isPrimary: true,
                type: 'BTREE',
            });
            expect(indexes[1]).toEqual({
                name: 'idx_name',
                columns: ['first_name', 'last_name'],
                isUnique: false,
                isPrimary: false,
                type: 'BTREE',
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.getIndexes('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getTriggers', () => {
        it('should return triggers', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[
                { name: 'before_insert', event: 'INSERT', timing: 'BEFORE', definition: 'SET NEW.created_at = NOW()' },
            ]]);

            const triggers = await client.getTriggers('users');
            expect(triggers).toEqual([
                { name: 'before_insert', event: 'INSERT', timing: 'BEFORE', definition: 'SET NEW.created_at = NOW()' },
            ]);
        });

        it('should throw if not connected', async () => {
            await expect(client.getTriggers('users')).rejects.toThrow('Not connected');
        });
    });

    describe('getSchemaMap', () => {
        it('should return schema map grouped by table', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([[
                { TABLE_NAME: 'users', COLUMN_NAME: 'id' },
                { TABLE_NAME: 'users', COLUMN_NAME: 'name' },
                { TABLE_NAME: 'orders', COLUMN_NAME: 'id' },
                { TABLE_NAME: 'orders', COLUMN_NAME: 'total' },
            ]]);

            const schemaMap = await client.getSchemaMap();
            expect(schemaMap).toEqual({
                users: ['id', 'name'],
                orders: ['id', 'total'],
            });
        });

        it('should throw if not connected', async () => {
            await expect(client.getSchemaMap()).rejects.toThrow('Not connected');
        });

        it('should throw if no database selected', async () => {
            mockCreateConnection.mockResolvedValue({
                query: mockQuery,
                end: mockEnd,
                config: {},
            });
            await client.connect(mockConfig);

            await expect(client.getSchemaMap()).rejects.toThrow('No database selected');
        });
    });

    describe('JSON column type detection', () => {
        it('should detect JSON columns in getTableData (columnType 245)', async () => {
            await client.connect(mockConfig);
            const mockFields = [
                { name: 'id', columnType: 3 },      // INT
                { name: 'data', columnType: 245 },   // JSON
                { name: 'name', columnType: 253 },   // VARCHAR
            ];
            const mockRows = [
                { id: 1, data: '{"key":"value"}', name: 'Alice' },
            ];
            mockQuery.mockResolvedValue([mockRows, mockFields]);

            const result = await client.getTableData('users');
            expect(result.columnTypes).toEqual(['other', 'json', 'other']);
        });

        it('should detect JSON columns in executeQuery (columnType 245)', async () => {
            await client.connect(mockConfig);
            const mockFields = [
                { name: 'config', columnType: 245 },  // JSON
                { name: 'id', columnType: 3 },         // INT
            ];
            const mockRows = [
                { config: '{"setting":true}', id: 1 },
            ];
            mockQuery.mockResolvedValue([mockRows, mockFields]);

            const result = await client.executeQuery('SELECT config, id FROM settings');
            expect(result.columnTypes).toEqual(['json', 'other']);
            expect(result.columns).toEqual(['config', 'id']);
        });

        it('should mark all columns as other when no JSON columns exist', async () => {
            await client.connect(mockConfig);
            const mockFields = [
                { name: 'id', columnType: 3 },
                { name: 'name', columnType: 253 },
            ];
            const mockRows = [{ id: 1, name: 'Alice' }];
            mockQuery.mockResolvedValue([mockRows, mockFields]);

            const result = await client.getTableData('users');
            expect(result.columnTypes).toEqual(['other', 'other']);
            expect(result.columnTypes!.every(t => t === 'other')).toBe(true);
        });

        it('should handle multiple JSON columns', async () => {
            await client.connect(mockConfig);
            const mockFields = [
                { name: 'metadata', columnType: 245 },
                { name: 'tags', columnType: 245 },
            ];
            const mockRows = [
                { metadata: '{}', tags: '[]' },
            ];
            mockQuery.mockResolvedValue([mockRows, mockFields]);

            const result = await client.getTableData('items');
            expect(result.columnTypes).toEqual(['json', 'json']);
        });

        it('should not include columnTypes for non-SELECT (affectedRows) results', async () => {
            await client.connect(mockConfig);
            mockQuery.mockResolvedValue([{ affectedRows: 3 }, undefined]);

            const result = await client.executeQuery('UPDATE users SET name = "x"');
            expect(result.columnTypes).toBeUndefined();
        });
    });
});
