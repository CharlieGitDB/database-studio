import * as mysql from 'mysql2/promise';
import { ConnectionConfig, QueryResult, ColumnInfo, ConstraintInfo, IndexInfo, TriggerInfo } from '../types';

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

    async getConstraints(tableName: string, database?: string): Promise<ConstraintInfo[]> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const dbName = database || (this.connection as any).config.database;

        const query = `
            SELECT
                tc.CONSTRAINT_NAME as constraint_name,
                tc.CONSTRAINT_TYPE as constraint_type,
                GROUP_CONCAT(DISTINCT kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION) as columns,
                kcu.REFERENCED_TABLE_NAME as referenced_table,
                GROUP_CONCAT(DISTINCT kcu.REFERENCED_COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION) as referenced_columns,
                cc.CHECK_CLAUSE as check_clause
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                AND tc.TABLE_NAME = kcu.TABLE_NAME
            LEFT JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
                ON tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
                AND tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
            WHERE tc.TABLE_SCHEMA = ?
                AND tc.TABLE_NAME = ?
            GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE, kcu.REFERENCED_TABLE_NAME, cc.CHECK_CLAUSE
            ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME
        `;

        const [rows] = await this.connection.query(query, [dbName, tableName]);

        return (rows as any[]).map((row: any) => ({
            name: row.constraint_name,
            type: row.constraint_type as ConstraintInfo['type'],
            columns: row.columns ? row.columns.split(',') : [],
            definition: row.check_clause,
            referencedTable: row.referenced_table,
            referencedColumns: row.referenced_columns ? row.referenced_columns.split(',') : undefined
        }));
    }

    async getIndexes(tableName: string, database?: string): Promise<IndexInfo[]> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const dbName = database || (this.connection as any).config.database;

        // Use SHOW INDEX and group by Key_name
        const [rows] = await this.connection.query(`SHOW INDEX FROM \`${dbName}\`.\`${tableName}\``);

        // Group by index name
        const indexMap = new Map<string, IndexInfo>();
        for (const row of rows as any[]) {
            const indexName = row.Key_name;
            if (!indexMap.has(indexName)) {
                indexMap.set(indexName, {
                    name: indexName,
                    columns: [],
                    isUnique: row.Non_unique === 0,
                    isPrimary: indexName === 'PRIMARY',
                    type: row.Index_type
                });
            }
            indexMap.get(indexName)!.columns.push(row.Column_name);
        }

        return Array.from(indexMap.values());
    }

    async getTriggers(tableName: string, database?: string): Promise<TriggerInfo[]> {
        if (!this.connection) {
            throw new Error('Not connected');
        }

        const dbName = database || (this.connection as any).config.database;

        const query = `
            SELECT
                TRIGGER_NAME as name,
                EVENT_MANIPULATION as event,
                ACTION_TIMING as timing,
                ACTION_STATEMENT as definition
            FROM INFORMATION_SCHEMA.TRIGGERS
            WHERE EVENT_OBJECT_SCHEMA = ?
                AND EVENT_OBJECT_TABLE = ?
            ORDER BY TRIGGER_NAME
        `;

        const [rows] = await this.connection.query(query, [dbName, tableName]);

        return (rows as any[]).map((row: any) => ({
            name: row.name,
            event: row.event,
            timing: row.timing,
            definition: row.definition
        }));
    }
}
