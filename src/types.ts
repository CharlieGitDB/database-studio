export type DatabaseType = 'redis' | 'mysql' | 'postgresql' | 'mongodb';

export interface ConnectionConfig {
    id: string;
    name: string;
    type: DatabaseType;
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: string;
}

export interface RedisKey {
    key: string;
    type: string;
    ttl: number;
}

export interface TableSchema {
    name: string;
    type: string;
}

export interface QueryResult {
    columns: string[];
    rows: any[];
}
