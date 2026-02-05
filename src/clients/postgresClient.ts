import { Client } from 'pg';
import { ConnectionConfig, QueryResult, ColumnInfo, ConstraintInfo, IndexInfo, RuleInfo, TriggerInfo } from '../types';

export class PostgresClient {
    private client: Client | null = null;

    async connect(config: ConnectionConfig): Promise<void> {
        this.client = new Client({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database
        });

        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.end();
            this.client = null;
        }
    }

    async getSchemas(): Promise<string[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const result = await this.client.query(
            `SELECT schema_name FROM information_schema.schemata
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
             ORDER BY schema_name`
        );

        return result.rows.map((row: any) => row.schema_name);
    }

    async getTables(schema: string = 'public'): Promise<string[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const result = await this.client.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = $1 AND table_type = 'BASE TABLE'
             ORDER BY table_name`,
            [schema]
        );

        return result.rows.map((row: any) => row.table_name);
    }

    async getTableData(tableName: string, schema?: string, limit: number = 100): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        // Construct fully qualified table name with schema if provided
        const qualifiedTableName = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
        const query = `SELECT * FROM ${qualifiedTableName} LIMIT ${limit}`;
        const result = await this.client.query(query);

        const columns = result.fields.map((field: any) => field.name);

        // Convert row objects to arrays to match expected format
        const rows = result.rows.map((row: any) =>
            columns.map(col => row[col])
        );

        return {
            columns,
            rows
        };
    }

    async updateRecord(tableName: string, primaryKey: string, primaryKeyValue: any, updates: Record<string, any>, schema?: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const qualifiedTableName = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
        const setClause = Object.keys(updates)
            .map((key, index) => `"${key}" = $${index + 1}`)
            .join(', ');

        const values = [...Object.values(updates), primaryKeyValue];
        const query = `UPDATE ${qualifiedTableName} SET ${setClause} WHERE "${primaryKey}" = $${values.length}`;

        await this.client.query(query, values);
    }

    async deleteRecord(tableName: string, primaryKey: string, primaryKeyValue: any, schema?: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const qualifiedTableName = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
        const query = `DELETE FROM ${qualifiedTableName} WHERE "${primaryKey}" = $1`;
        await this.client.query(query, [primaryKeyValue]);
    }

    async executeQuery(query: string): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const result = await this.client.query(query);

        if (result.fields && result.fields.length > 0) {
            const columns = result.fields.map((field: any) => field.name);

            // Convert row objects to arrays to match expected format
            const rows = result.rows.map((row: any) =>
                columns.map(col => row[col])
            );

            return {
                columns,
                rows
            };
        }

        return {
            columns: ['rowCount'],
            rows: [[result.rowCount || 0]]
        };
    }

    isConnected(): boolean {
        return this.client !== null;
    }

    async getColumns(tableName: string, schema: string = 'public'): Promise<ColumnInfo[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        // Get column information including type, nullable, and primary key status
        const columnsQuery = `
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_schema = $1
                AND c.table_name = $2
            ORDER BY c.ordinal_position
        `;

        const columnsResult = await this.client.query(columnsQuery, [schema, tableName]);

        // Get foreign key information
        const fkQuery = `
            SELECT
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = $1
                AND tc.table_name = $2
        `;

        const fkResult = await this.client.query(fkQuery, [schema, tableName]);

        // Create a map of foreign key information
        const fkMap = new Map<string, { table: string; column: string }>();
        for (const row of fkResult.rows) {
            fkMap.set(row.column_name, {
                table: row.foreign_table_name,
                column: row.foreign_column_name
            });
        }

        // Combine the results
        return columnsResult.rows.map((row: any) => {
            const fk = fkMap.get(row.column_name);
            return {
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES',
                isPrimaryKey: row.is_primary_key,
                isForeignKey: !!fk,
                referencedTable: fk?.table,
                referencedColumn: fk?.column
            };
        });
    }

    async getConstraints(tableName: string, schema: string = 'public'): Promise<ConstraintInfo[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const query = `
            SELECT tc.constraint_name, tc.constraint_type,
                   array_agg(DISTINCT kcu.column_name ORDER BY kcu.column_name) as columns,
                   ccu.table_name as foreign_table,
                   array_agg(DISTINCT ccu.column_name) FILTER (WHERE tc.constraint_type = 'FOREIGN KEY') as foreign_columns,
                   cc.check_clause
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name AND tc.constraint_type = 'FOREIGN KEY'
            LEFT JOIN information_schema.check_constraints cc
                ON tc.constraint_name = cc.constraint_name
            WHERE tc.table_schema = $1 AND tc.table_name = $2
            GROUP BY tc.constraint_name, tc.constraint_type, ccu.table_name, cc.check_clause
            ORDER BY tc.constraint_type, tc.constraint_name
        `;

        const result = await this.client.query(query, [schema, tableName]);

        return result.rows.map((row: any) => ({
            name: row.constraint_name,
            type: row.constraint_type as ConstraintInfo['type'],
            columns: this.parseArrayColumn(row.columns),
            definition: row.check_clause,
            referencedTable: row.foreign_table,
            referencedColumns: row.foreign_columns ? this.parseArrayColumn(row.foreign_columns) : undefined
        }));
    }

    private parseArrayColumn(value: any): string[] {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return value.filter((c: string | null) => c !== null);
        }
        // Handle PostgreSQL array string format like {col1,col2}
        if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
            const inner = value.slice(1, -1);
            if (inner === '') {
                return [];
            }
            return inner.split(',').map(s => s.trim()).filter(s => s !== '' && s !== 'NULL');
        }
        return [];
    }

    async getIndexes(tableName: string, schema: string = 'public'): Promise<IndexInfo[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const query = `
            SELECT i.relname as index_name,
                   array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                   ix.indisunique as is_unique, ix.indisprimary as is_primary, am.amname as index_type
            FROM pg_index ix
            JOIN pg_class i ON ix.indexrelid = i.oid
            JOIN pg_class t ON ix.indrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            JOIN pg_am am ON i.relam = am.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE n.nspname = $1 AND t.relname = $2
            GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
            ORDER BY i.relname
        `;

        const result = await this.client.query(query, [schema, tableName]);

        return result.rows.map((row: any) => ({
            name: row.index_name,
            columns: this.parseArrayColumn(row.columns),
            isUnique: row.is_unique,
            isPrimary: row.is_primary,
            type: row.index_type
        }));
    }

    async getRules(tableName: string, schema: string = 'public'): Promise<RuleInfo[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const query = `
            SELECT r.rulename as name,
                   CASE r.ev_type WHEN '1' THEN 'SELECT' WHEN '2' THEN 'UPDATE'
                                  WHEN '3' THEN 'INSERT' WHEN '4' THEN 'DELETE' END as event,
                   pg_get_ruledef(r.oid) as definition
            FROM pg_rewrite r
            JOIN pg_class c ON r.ev_class = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = $1 AND c.relname = $2 AND r.rulename != '_RETURN'
            ORDER BY r.rulename
        `;

        const result = await this.client.query(query, [schema, tableName]);

        return result.rows.map((row: any) => ({
            name: row.name,
            event: row.event,
            definition: row.definition
        }));
    }

    async getTriggers(tableName: string, schema: string = 'public'): Promise<TriggerInfo[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const query = `
            SELECT t.tgname as name,
                   CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
                        WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF' ELSE 'AFTER' END as timing,
                   CONCAT_WS(' OR ',
                       CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
                       CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
                       CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END) as event,
                   pg_get_triggerdef(t.oid) as definition
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = $1 AND c.relname = $2 AND NOT t.tgisinternal
            ORDER BY t.tgname
        `;

        const result = await this.client.query(query, [schema, tableName]);

        return result.rows.map((row: any) => ({
            name: row.name,
            timing: row.timing,
            event: row.event,
            definition: row.definition
        }));
    }
}
