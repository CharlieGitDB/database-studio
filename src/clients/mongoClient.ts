import { MongoClient, Db, ObjectId } from 'mongodb';
import { ConnectionConfig, QueryResult } from '../types';

export class MongoDBClient {
    private client: MongoClient | null = null;
    private db: Db | null = null;

    async connect(config: ConnectionConfig): Promise<void> {
        const uri = config.username && config.password
            ? `mongodb://${config.username}:${config.password}@${config.host}:${config.port}`
            : `mongodb://${config.host}:${config.port}`;

        this.client = new MongoClient(uri);
        await this.client.connect();

        // Only set db if a specific database was provided
        if (config.database) {
            this.db = this.client.db(config.database);
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
        }
    }

    async getDatabases(): Promise<string[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const adminDb = this.client.db('admin');
        const result = await adminDb.admin().listDatabases();
        return result.databases.map(db => db.name);
    }

    async getCollections(databaseName?: string): Promise<string[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        // If a database name is provided, use it; otherwise use the default db
        const targetDb = databaseName ? this.client.db(databaseName) : this.db;

        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collections = await targetDb.listCollections().toArray();
        return collections.map(col => col.name);
    }

    async getCollectionData(collectionName: string, databaseName?: string, limit: number = 100): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        const documents = await collection.find({}).limit(limit).toArray();

        if (documents.length === 0) {
            return { columns: [], rows: [] };
        }

        // Get all unique keys from all documents
        const allKeys = new Set<string>();
        documents.forEach(doc => {
            Object.keys(doc).forEach(key => allKeys.add(key));
        });

        const columns = Array.from(allKeys);

        const rows = documents.map(doc => {
            return columns.map(col => {
                const value = doc[col];
                if (value instanceof ObjectId) {
                    return value.toString();
                }
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value;
            });
        });

        return { columns, rows };
    }

    async updateDocument(collectionName: string, id: string, updates: Record<string, any>, databaseName?: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        const { _id, ...updateFields } = updates;

        await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateFields }
        );
    }

    async deleteDocument(collectionName: string, id: string, databaseName?: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        await collection.deleteOne({ _id: new ObjectId(id) });
    }

    async executeQuery(collectionName: string, query: string, databaseName?: string): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        const queryObj = JSON.parse(query);
        const documents = await collection.find(queryObj).limit(100).toArray();

        if (documents.length === 0) {
            return { columns: [], rows: [] };
        }

        const allKeys = new Set<string>();
        documents.forEach(doc => {
            Object.keys(doc).forEach(key => allKeys.add(key));
        });

        const columns = Array.from(allKeys);

        const rows = documents.map(doc => {
            return columns.map(col => {
                const value = doc[col];
                if (value instanceof ObjectId) {
                    return value.toString();
                }
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value;
            });
        });

        return { columns, rows };
    }

    async insertDocument(collectionName: string, document: Record<string, any>, databaseName?: string): Promise<string> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        const result = await collection.insertOne(document);
        return result.insertedId.toString();
    }

    async aggregate(collectionName: string, pipeline: any[], databaseName?: string): Promise<QueryResult> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        const documents = await collection.aggregate(pipeline).toArray();

        if (documents.length === 0) {
            return { columns: [], rows: [] };
        }

        const allKeys = new Set<string>();
        documents.forEach(doc => {
            Object.keys(doc).forEach(key => allKeys.add(key));
        });

        const columns = Array.from(allKeys);

        const rows = documents.map(doc => {
            return columns.map(col => {
                const value = doc[col];
                if (value instanceof ObjectId) {
                    return value.toString();
                }
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value;
            });
        });

        return { columns, rows };
    }

    async getIndexes(collectionName: string, databaseName?: string): Promise<any[]> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        return await collection.indexes();
    }

    async createIndex(collectionName: string, keys: Record<string, any>, options?: any, databaseName?: string): Promise<string> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        return await collection.createIndex(keys, options);
    }

    async dropIndex(collectionName: string, indexName: string, databaseName?: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        await collection.dropIndex(indexName);
    }

    async getDocumentById(collectionName: string, id: string, databaseName?: string): Promise<any> {
        if (!this.client) {
            throw new Error('Not connected');
        }

        const targetDb = databaseName ? this.client.db(databaseName) : this.db;
        if (!targetDb) {
            throw new Error('No database specified');
        }

        const collection = targetDb.collection(collectionName);
        return await collection.findOne({ _id: new ObjectId(id) });
    }

    isConnected(): boolean {
        return this.client !== null;
    }
}
