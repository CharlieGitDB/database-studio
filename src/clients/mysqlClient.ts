import * as mysql from 'mysql2/promise';
import { ConnectionConfig, QueryResult, ColumnInfo } from '../types';

export class MySQLClient {
    private connection: mysql.Connection | null = null;

    async connect(config: ConnectionConfig): Promise<void> {
        this.connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database
        });
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }

    async getTables(): Promise<string[]> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const [rows] = await this.connection.query('SHOW TABLES');
        return (rows as any[]).map(row => Object.values(row)[0] as string);
    }

    async getTableData(tableName: string, limit: number = 100): Promise<QueryResult> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const query = `SELECT * FROM \`${tableName}\` LIMIT ${limit}`;
        const [rows, fields] = await this.connection.query(query);

        const columns = (fields as mysql.FieldPacket[]).map(field => field.name);
        const data = rows as any[];

        return {
            columns,
            rows: data
        };
    }

    async updateRecord(tableName: string, primaryKey: string, primaryKeyValue: any, updates: Record<string, any>): Promise<void> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const setClause = Object.keys(updates)
            .map(key => `\`${key}\` = ?`)
            .join(', ');

        const values = [...Object.values(updates), primaryKeyValue];
        const query = `UPDATE \`${tableName}\` SET ${setClause} WHERE \`${primaryKey}\` = ?`;

        await this.connection.query(query, values);
    }

    async deleteRecord(tableName: string, primaryKey: string, primaryKeyValue: any): Promise<void> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const query = `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`;
        await this.connection.query(query, [primaryKeyValue]);
    }

    async executeQuery(query: string): Promise<QueryResult> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const [rows, fields] = await this.connection.query(query);

        if (Array.isArray(fields)) {
            const columns = fields.map(field => field.name);
            return {
                columns,
                rows: rows as any[]
            };
        }

        return {
            columns: ['affectedRows'],
            rows: [[((rows as any).affectedRows || 0)]]
        };
    }

    isConnected(): boolean {
        return this.connection !== null;
    }

    async getColumns(tableName: string, database?: string): Promise<ColumnInfo[]> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const dbName = database || (this.connection as any).config.database;

        // Get column information including type, nullable, and key status
        const columnsQuery = `
            SELECT
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_KEY as column_key
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;

        const [columnsResult] = await this.connection.query(columnsQuery, [dbName, tableName]);

        // Get foreign key information
        const fkQuery = `
            SELECT
                COLUMN_NAME as column_name,
                REFERENCED_TABLE_NAME as referenced_table_name,
                REFERENCED_COLUMN_NAME as referenced_column_name
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = ?
                AND REFERENCED_TABLE_NAME IS NOT NULL
        `;

        const [fkResult] = await this.connection.query(fkQuery, [dbName, tableName]);

        // Create a map of foreign key information
        const fkMap = new Map<string, { table: string; column: string }>();
        for (const row of fkResult as any[]) {
            fkMap.set(row.column_name, {
                table: row.referenced_table_name,
                column: row.referenced_column_name
            });
        }

        // Combine the results
        return (columnsResult as any[]).map((row: any) => {
            const fk = fkMap.get(row.column_name);
            return {
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES',
                isPrimaryKey: row.column_key === 'PRI',
                isForeignKey: !!fk,
                referencedTable: fk?.table,
                referencedColumn: fk?.column
            };
        });
    }
}
