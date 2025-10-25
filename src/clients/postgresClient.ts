import { Client } from 'pg';
import { ConnectionConfig, QueryResult, ColumnInfo } from '../types';

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
}
