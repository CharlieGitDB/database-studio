import * as vscode from 'vscode';
import { ConnectionConfig } from './types';

export class ConnectionManager {
    private connections: Map<string, ConnectionConfig> = new Map();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadConnections();
    }

    private loadConnections() {
        const saved = this.context.globalState.get<ConnectionConfig[]>('connections', []);
        saved.forEach(conn => this.connections.set(conn.id, conn));
    }

    private async saveConnections() {
        const allConnections = Array.from(this.connections.values());
        await this.context.globalState.update('connections', allConnections);
    }

    async addConnection(config: ConnectionConfig): Promise<void> {
        this.connections.set(config.id, config);
        await this.saveConnections();
    }

    async updateConnection(config: ConnectionConfig): Promise<void> {
        this.connections.set(config.id, config);
        await this.saveConnections();
    }

    async deleteConnection(id: string): Promise<void> {
        this.connections.delete(id);
        await this.saveConnections();
    }

    getConnection(id: string): ConnectionConfig | undefined {
        return this.connections.get(id);
    }

    getAllConnections(): ConnectionConfig[] {
        return Array.from(this.connections.values());
    }
}
