import { QueryBuilder } from '../queryBuilder';
import { QueryBuilderState, FilterCondition, JoinClause, OrderByClause, SelectColumn } from '../types';

describe('QueryBuilder', () => {
    describe('generateSQL', () => {
        it('should generate basic SELECT * query', () => {
            const state = QueryBuilder.createEmptyState('users');
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toBe('SELECT *\nFROM "users";');
        });

        it('should generate SELECT with specific columns', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'id', aggregate: 'NONE' },
                    { column: 'name', aggregate: 'NONE' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('SELECT "id", "name"');
        });

        it('should generate DISTINCT query', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                distinct: true,
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('SELECT DISTINCT *');
        });

        it('should generate query with column aliases', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'name', alias: 'user_name', aggregate: 'NONE' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('"name" AS "user_name"');
        });

        it('should generate query with aggregate functions', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'id', aggregate: 'COUNT' },
                    { column: 'age', aggregate: 'AVG' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('COUNT("id")');
            expect(sql).toContain('AVG("age")');
        });

        it('should generate query with schema prefix for PostgreSQL', () => {
            const state = QueryBuilder.createEmptyState('users', 'public');
            const sql = QueryBuilder.generateSQL(state, 'postgresql');
            expect(sql).toContain('FROM "public"."users"');
        });

        it('should not add schema prefix for MySQL', () => {
            const state = QueryBuilder.createEmptyState('users', 'public');
            const sql = QueryBuilder.generateSQL(state, 'mysql');
            expect(sql).toContain('FROM `users`');
            expect(sql).not.toContain('public');
        });

        it('should use backticks for MySQL', () => {
            const state = QueryBuilder.createEmptyState('users');
            const sql = QueryBuilder.generateSQL(state, 'mysql');
            expect(sql).toContain('`users`');
        });

        it('should use double quotes for PostgreSQL', () => {
            const state = QueryBuilder.createEmptyState('users');
            const sql = QueryBuilder.generateSQL(state, 'postgresql');
            expect(sql).toContain('"users"');
        });

        it('should generate WHERE clause with comparison operators', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'age', operator: '>', value: '18' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('WHERE "age" > 18');
        });

        it('should generate WHERE clause with IS NULL', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'email', operator: 'IS NULL', value: '' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('WHERE "email" IS NULL');
        });

        it('should generate WHERE clause with IS NOT NULL', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'email', operator: 'IS NOT NULL', value: '' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('WHERE "email" IS NOT NULL');
        });

        it('should generate WHERE clause with IN operator', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'status', operator: 'IN', value: 'active,inactive' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain("WHERE \"status\" IN ('active', 'inactive')");
        });

        it('should generate WHERE clause with LIKE operator', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'name', operator: 'LIKE', value: '%john%' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain("WHERE \"name\" LIKE '%john%'");
        });

        it('should combine multiple filters with logical operators', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'age', operator: '>', value: '18', logicalOperator: 'AND' },
                    { column: 'status', operator: '=', value: 'active' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('WHERE "age" > 18 AND "status" = \'active\'');
        });

        it('should generate JOIN clauses', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                joins: [
                    { table: 'orders', type: 'INNER', leftColumn: 'users.id', rightColumn: 'orders.user_id' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('INNER JOIN "orders" ON "users.id" = "orders.user_id"');
        });

        it('should generate LEFT JOIN', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                joins: [
                    { table: 'orders', type: 'LEFT', leftColumn: 'users.id', rightColumn: 'orders.user_id' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('LEFT JOIN');
        });

        it('should generate GROUP BY clause', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'status', aggregate: 'NONE' },
                    { column: 'id', aggregate: 'COUNT' },
                ],
                groupBy: ['status'],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('GROUP BY "status"');
        });

        it('should generate ORDER BY clause', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                orderBy: [
                    { column: 'name', direction: 'ASC', priority: 1 },
                    { column: 'age', direction: 'DESC', priority: 2 },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('ORDER BY "name" ASC, "age" DESC');
        });

        it('should sort ORDER BY by priority', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                orderBy: [
                    { column: 'age', direction: 'DESC', priority: 2 },
                    { column: 'name', direction: 'ASC', priority: 1 },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('ORDER BY "name" ASC, "age" DESC');
        });

        it('should generate LIMIT clause', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                limit: 10,
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('LIMIT 10');
        });

        it('should generate OFFSET clause', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                offset: 20,
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('OFFSET 20');
        });

        it('should generate complex query with all clauses', () => {
            const state: QueryBuilderState = {
                table: 'users',
                schema: 'public',
                distinct: true,
                selectColumns: [
                    { column: 'status', aggregate: 'NONE' },
                    { column: 'id', aggregate: 'COUNT', alias: 'user_count' },
                ],
                filters: [
                    { column: 'age', operator: '>', value: '18', logicalOperator: 'AND' },
                    { column: 'status', operator: '!=', value: 'deleted' },
                ],
                joins: [
                    { table: 'profiles', type: 'LEFT', leftColumn: 'users.id', rightColumn: 'profiles.user_id' },
                ],
                orderBy: [
                    { column: 'user_count', direction: 'DESC', priority: 1 },
                ],
                groupBy: ['status'],
                limit: 50,
                offset: 10,
            };
            const sql = QueryBuilder.generateSQL(state, 'postgresql');

            expect(sql).toContain('SELECT DISTINCT');
            expect(sql).toContain('"status"');
            expect(sql).toContain('COUNT("id") AS "user_count"');
            expect(sql).toContain('FROM "public"."users"');
            expect(sql).toContain('LEFT JOIN');
            expect(sql).toContain('WHERE');
            expect(sql).toContain('GROUP BY');
            expect(sql).toContain('ORDER BY');
            expect(sql).toContain('LIMIT 50');
            expect(sql).toContain('OFFSET 10');
        });

        it('should escape identifiers with special chars in MySQL', () => {
            const state = QueryBuilder.createEmptyState('user`table');
            const sql = QueryBuilder.generateSQL(state, 'mysql');
            expect(sql).toContain('`user``table`');
        });

        it('should escape identifiers with special chars in PostgreSQL', () => {
            const state = QueryBuilder.createEmptyState('user"table');
            const sql = QueryBuilder.generateSQL(state, 'postgresql');
            expect(sql).toContain('"user""table"');
        });

        it('should handle pre-quoted values', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'name', operator: '=', value: "'John'" },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain("'John'");
        });

        it('should handle numeric values without quoting', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'age', operator: '=', value: '25' },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain('"age" = 25');
        });

        it('should escape single quotes in string values', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [
                    { column: 'name', operator: '=', value: "O'Brien" },
                ],
            };
            const sql = QueryBuilder.generateSQL(state);
            expect(sql).toContain("'O''Brien'");
        });
    });

    describe('validate', () => {
        it('should be valid for a simple state', () => {
            const state = QueryBuilder.createEmptyState('users');
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should be invalid when table name is empty', () => {
            const state = QueryBuilder.createEmptyState('');
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Table name is required');
        });

        it('should be invalid when table name is whitespace', () => {
            const state = QueryBuilder.createEmptyState('   ');
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
        });

        it('should validate LIMIT is positive integer', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                limit: -1,
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('LIMIT must be a positive integer');
        });

        it('should validate LIMIT is integer', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                limit: 1.5,
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
        });

        it('should validate OFFSET is non-negative integer', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                offset: -1,
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('OFFSET must be a non-negative integer');
        });

        it('should validate filter column is not empty', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [{ column: '', operator: '=', value: 'test' }],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Filter column cannot be empty');
        });

        it('should validate filter value for non-null operators', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [{ column: 'name', operator: '=', value: '' }],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Filter value is required for operator "="');
        });

        it('should allow empty value for IS NULL', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [{ column: 'name', operator: 'IS NULL', value: '' }],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(true);
        });

        it('should allow empty value for IS NOT NULL', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                filters: [{ column: 'name', operator: 'IS NOT NULL', value: '' }],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(true);
        });

        it('should validate join completeness', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                joins: [{ table: '', type: 'INNER', leftColumn: 'a', rightColumn: 'b' }],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Join requires table, left column, and right column');
        });

        it('should validate ORDER BY column is not empty', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                orderBy: [{ column: '', direction: 'ASC', priority: 1 }],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('ORDER BY column cannot be empty');
        });

        it('should warn about aggregates without GROUP BY', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'status', aggregate: 'NONE' },
                    { column: 'id', aggregate: 'COUNT' },
                ],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('When using aggregate functions with non-aggregated columns, you must specify GROUP BY');
        });

        it('should be valid with aggregates and GROUP BY', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'status', aggregate: 'NONE' },
                    { column: 'id', aggregate: 'COUNT' },
                ],
                groupBy: ['status'],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(true);
        });

        it('should be valid when all columns are aggregated', () => {
            const state: QueryBuilderState = {
                ...QueryBuilder.createEmptyState('users'),
                selectColumns: [
                    { column: 'id', aggregate: 'COUNT' },
                    { column: 'age', aggregate: 'AVG' },
                ],
            };
            const result = QueryBuilder.validate(state);
            expect(result.valid).toBe(true);
        });
    });

    describe('createEmptyState', () => {
        it('should create empty state with table name', () => {
            const state = QueryBuilder.createEmptyState('users');
            expect(state).toEqual({
                table: 'users',
                schema: undefined,
                distinct: false,
                selectColumns: [],
                filters: [],
                joins: [],
                orderBy: [],
                groupBy: [],
            });
        });

        it('should create empty state with schema', () => {
            const state = QueryBuilder.createEmptyState('users', 'public');
            expect(state.schema).toBe('public');
        });
    });

    describe('parseSQL', () => {
        it('should parse basic SELECT query', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users;');
            expect(state).not.toBeNull();
            expect(state!.table).toBe('users');
        });

        it('should detect DISTINCT', () => {
            const state = QueryBuilder.parseSQL('SELECT DISTINCT * FROM users;');
            expect(state!.distinct).toBe(true);
        });

        it('should not detect DISTINCT in non-DISTINCT query', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users;');
            expect(state!.distinct).toBe(false);
        });

        it('should extract LIMIT', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users LIMIT 10;');
            expect(state!.limit).toBe(10);
        });

        it('should extract OFFSET', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users OFFSET 20;');
            expect(state!.offset).toBe(20);
        });

        it('should extract schema from qualified table name', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM public.users;');
            expect(state!.table).toBe('users');
            expect(state!.schema).toBe('public');
        });

        it('should use provided schema when not in query', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users;', 'custom');
            expect(state!.schema).toBe('custom');
        });

        it('should return null for unparseable query', () => {
            const state = QueryBuilder.parseSQL('INSERT INTO users VALUES (1)');
            expect(state).toBeNull();
        });

        it('should handle query without semicolon', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users');
            expect(state).not.toBeNull();
            expect(state!.table).toBe('users');
        });

        it('should extract LIMIT and OFFSET together', () => {
            const state = QueryBuilder.parseSQL('SELECT * FROM users LIMIT 10 OFFSET 5;');
            expect(state!.limit).toBe(10);
            expect(state!.offset).toBe(5);
        });
    });
});
