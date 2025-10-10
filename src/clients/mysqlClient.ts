import * as mysql from 'mysql2/promise';
import { ConnectionConfig, QueryResult } from '../types';

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
}
