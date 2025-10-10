import Redis from 'ioredis';
import { ConnectionConfig, RedisKey, QueryResult } from '../types';

export class RedisClient {
    private client: Redis | null = null;

    async connect(config: ConnectionConfig): Promise<void> {
        this.client = new Redis({
            host: config.host,
            port: config.port,
            password: config.password,
            lazyConnect: true
        });

        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
    }

    async getKeys(pattern: string = '*', limit: number = 100): Promise<RedisKey[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const keys = await this.client.keys(pattern);
        const limitedKeys = keys.slice(0, limit);

        const keyInfos: RedisKey[] = [];
        for (const key of limitedKeys) {
            const type = await this.client.type(key);
            const ttl = await this.client.ttl(key);
            keyInfos.push({ key, type, ttl });
        }

        return keyInfos;
    }

    async getValue(key: string): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const type = await this.client.type(key);
        let value: any;

        switch (type) {
            case 'string':
                value = await this.client.get(key);
                break;
            case 'list':
                value = await this.client.lrange(key, 0, -1);
                break;
            case 'set':
                value = await this.client.smembers(key);
                break;
            case 'zset':
                value = await this.client.zrange(key, 0, -1, 'WITHSCORES');
                break;
            case 'hash':
                value = await this.client.hgetall(key);
                break;
            default:
                value = 'Unknown type';
        }

        return {
            columns: ['Key', 'Type', 'Value'],
            rows: [[key, type, JSON.stringify(value, null, 2)]]
        };
    }

    async setValue(key: string, value: string, type: string = 'string'): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        switch (type) {
            case 'string':
                await this.client.set(key, value);
                break;
            case 'hash':
                const hashData = JSON.parse(value);
                await this.client.hset(key, hashData);
                break;
            case 'list':
                const listData = JSON.parse(value);
                await this.client.del(key);
                if (Array.isArray(listData)) {
                    await this.client.rpush(key, ...listData);
                }
                break;
            case 'set':
                const setData = JSON.parse(value);
                await this.client.del(key);
                if (Array.isArray(setData)) {
                    await this.client.sadd(key, ...setData);
                }
                break;
            default:
                throw new Error(`Unsupported type: ${type}`);
        }
    }

    async deleteKey(key: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        await this.client.del(key);
    }

    isConnected(): boolean {
        return this.client !== null && this.client.status === 'ready';
    }
}
