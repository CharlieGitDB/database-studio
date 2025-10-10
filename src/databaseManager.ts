import { ConnectionConfig, DatabaseType } from './types';
import { RedisClient } from './clients/redisClient';
import { MySQLClient } from './clients/mysqlClient';
import { PostgresClient } from './clients/postgresClient';
import { MongoDBClient } from './clients/mongoClient';

type DatabaseClient = RedisClient | MySQLClient | PostgresClient | MongoDBClient;

export class DatabaseManager {
    private clients: Map<string, DatabaseClient> = new Map();

    async connect(config: ConnectionConfig): Promise<void> {
        let client: DatabaseClient;

        switch (config.type) {
            case 'redis':
                client = new RedisClient();
                break;
            case 'mysql':
                client = new MySQLClient();
                break;
            case 'postgresql':
                client = new PostgresClient();
                break;
            case 'mongodb':
                client = new MongoDBClient();
                break;
            default:
                throw new Error(`Unsupported database type: ${config.type}`);
        }

        await client.connect(config);
        this.clients.set(config.id, client);
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.clients.get(connectionId);
        if (client) {
            await client.disconnect();
            this.clients.delete(connectionId);
        }
    }

    getClient(connectionId: string): DatabaseClient | undefined {
        return this.clients.get(connectionId);
    }

    isConnected(connectionId: string): boolean {
        const client = this.clients.get(connectionId);
        return client ? client.isConnected() : false;
    }

    async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.clients.keys()).map(id => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
}
