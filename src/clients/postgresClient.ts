import { Client } from 'pg';
import { ConnectionConfig, QueryResult } from '../types';

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

    async getTableData(tableName: string, limit: number = 100): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const query = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
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

    async updateRecord(tableName: string, primaryKey: string, primaryKeyValue: any, updates: Record<string, any>): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const setClause = Object.keys(updates)
            .map((key, index) => `"${key}" = $${index + 1}`)
            .join(', ');

        const values = [...Object.values(updates), primaryKeyValue];
        const query = `UPDATE "${tableName}" SET ${setClause} WHERE "${primaryKey}" = $${values.length}`;

        await this.client.query(query, values);
    }

    async deleteRecord(tableName: string, primaryKey: string, primaryKeyValue: any): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const query = `DELETE FROM "${tableName}" WHERE "${primaryKey}" = $1`;
        await this.client.query(query, [primaryKeyValue]);
    }

    async executeQuery(query: string): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const result = await this.client.query(query);

        if (result.fields && result.fields.length > 0) {
            const columns = result.fields.map((field: any) => field.name);
            return {
                columns,
                rows: result.rows
            };
        }

        return {
            columns: ['rowCount'],
            rows: [[(result.rowCount || 0)]]
        };
    }

    isConnected(): boolean {
        return this.client !== null;
    }
}
