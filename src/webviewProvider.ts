import * as vscode from 'vscode';
import { DatabaseManager } from './databaseManager';
import { ConnectionManager } from './connectionManager';
import { QueryResult } from './types';
import { RedisClient } from './clients/redisClient';
import { MySQLClient } from './clients/mysqlClient';
import { PostgresClient } from './clients/postgresClient';
import { MongoDBClient } from './clients/mongoClient';

export class DataViewerPanel {
    public static currentPanel: DataViewerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private currentSchema?: string;

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly databaseManager: DatabaseManager,
        private readonly connectionManager: ConnectionManager
    ) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        await this.loadData(message.connectionId, message.resource, message.schema);
                        break;
                    case 'edit':
                        await this.editRecord(message.connectionId, message.resource, message.data, message.schema);
                        break;
                    case 'delete':
                        await this.deleteRecord(message.connectionId, message.resource, message.data, message.schema);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager,
        connectionManager: ConnectionManager,
        connectionId: string,
        resource: string,
        schema?: string
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DataViewerPanel.currentPanel) {
            DataViewerPanel.currentPanel._panel.reveal(column);
            DataViewerPanel.currentPanel.loadData(connectionId, resource, schema);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'databaseViewer',
            'Database Viewer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        DataViewerPanel.currentPanel = new DataViewerPanel(panel, databaseManager, connectionManager);
        DataViewerPanel.currentPanel.loadData(connectionId, resource, schema);
    }

    private async loadData(connectionId: string, resource: string, schema?: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);
            const config = this.connectionManager.getConnection(connectionId);

            if (!client || !config) {
                this.showError('Connection not found');
                return;
            }

            // Store the current schema for use in edit/delete operations
            this.currentSchema = schema;

            let data: QueryResult;

            if (client instanceof RedisClient) {
                if (resource === 'keys') {
                    const keys = await client.getKeys();
                    data = {
                        columns: ['Key', 'Type', 'TTL'],
                        rows: keys.map(k => [k.key, k.type, k.ttl.toString()])
                    };
                } else {
                    data = await client.getValue(resource);
                }
            } else if (client instanceof MySQLClient) {
                data = await client.getTableData(resource);
            } else if (client instanceof PostgresClient) {
                data = await client.getTableData(resource, schema);
            } else if (client instanceof MongoDBClient) {
                data = await client.getCollectionData(resource);
            } else {
                this.showError('Unsupported database type');
                return;
            }

            this._panel.webview.html = this.getWebviewContent(data, connectionId, resource, config.type, schema);
        } catch (error) {
            this.showError(`Failed to load data: ${error}`);
        }
    }

    private async editRecord(connectionId: string, resource: string, data: any, schema?: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);
            const config = this.connectionManager.getConnection(connectionId);

            if (!client || !config) {
                this.showError('Connection not found');
                return;
            }

            if (client instanceof RedisClient) {
                await client.setValue(data.key, data.value, data.type);
            } else if (client instanceof MySQLClient) {
                await client.updateRecord(resource, data.primaryKey, data.primaryKeyValue, data.updates);
            } else if (client instanceof PostgresClient) {
                await client.updateRecord(resource, data.primaryKey, data.primaryKeyValue, data.updates, schema);
            } else if (client instanceof MongoDBClient) {
                await client.updateDocument(resource, data.id, data.updates);
            }

            vscode.window.showInformationMessage('Record updated successfully');
            await this.loadData(connectionId, resource, schema);
        } catch (error) {
            this.showError(`Failed to update record: ${error}`);
        }
    }

    private async deleteRecord(connectionId: string, resource: string, data: any, schema?: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);
            const config = this.connectionManager.getConnection(connectionId);

            if (!client || !config) {
                this.showError('Connection not found');
                return;
            }

            if (client instanceof RedisClient) {
                await client.deleteKey(data.key);
            } else if (client instanceof MySQLClient) {
                await client.deleteRecord(resource, data.primaryKey, data.primaryKeyValue);
            } else if (client instanceof PostgresClient) {
                await client.deleteRecord(resource, data.primaryKey, data.primaryKeyValue, schema);
            } else if (client instanceof MongoDBClient) {
                await client.deleteDocument(resource, data.id);
            }

            vscode.window.showInformationMessage('Record deleted successfully');
            await this.loadData(connectionId, resource, schema);
        } catch (error) {
            this.showError(`Failed to delete record: ${error}`);
        }
    }

    private showError(message: string) {
        vscode.window.showErrorMessage(message);
        this._panel.webview.html = `<html><body><h2>Error</h2><p>${message}</p></body></html>`;
    }

    private getWebviewContent(data: QueryResult, connectionId: string, resource: string, dbType: string, schema?: string): string {
        const rows = data.rows.map(row => {
            return data.columns.map((col, idx) => {
                const value = row[idx];
                return typeof value === 'object' ? JSON.stringify(value) : String(value);
            });
        });

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Viewer</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: var(--vscode-editor-selectionBackground);
            font-weight: bold;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            margin: 2px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .actions {
            margin-bottom: 10px;
        }
        .edit-form {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 20px;
            z-index: 1000;
            max-width: 600px;
            width: 90%;
        }
        .overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        }
        textarea {
            width: 100%;
            min-height: 100px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
        }
        input {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px;
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <h2>${resource}</h2>
    <div class="actions">
        <button onclick="refresh()">Refresh</button>
    </div>
    <table>
        <thead>
            <tr>
                ${data.columns.map(col => `<th>${col}</th>`).join('')}
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map((row, rowIdx) => `
                <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                    <td>
                        <button onclick="editRow(${rowIdx})">Edit</button>
                        <button onclick="deleteRow(${rowIdx})">Delete</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="overlay" id="overlay"></div>
    <div class="edit-form" id="editForm">
        <h3>Edit Record</h3>
        <div id="editFields"></div>
        <button onclick="saveEdit()">Save</button>
        <button onclick="closeEdit()">Cancel</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const data = ${JSON.stringify({ columns: data.columns, rows })};
        const connectionId = '${connectionId}';
        const resource = '${resource}';
        const dbType = '${dbType}';
        const schema = ${schema ? `'${schema}'` : 'undefined'};
        let currentEditRow = null;

        function refresh() {
            vscode.postMessage({ command: 'refresh', connectionId, resource, schema });
        }

        function editRow(rowIdx) {
            currentEditRow = rowIdx;
            const row = data.rows[rowIdx];
            const fields = document.getElementById('editFields');
            fields.innerHTML = data.columns.map((col, idx) =>
                '<label>' + col + ':</label><br>' +
                '<input type="text" id="field_' + idx + '" value="' + (row[idx] || '') + '"><br>'
            ).join('');

            document.getElementById('overlay').style.display = 'block';
            document.getElementById('editForm').style.display = 'block';
        }

        function closeEdit() {
            document.getElementById('overlay').style.display = 'none';
            document.getElementById('editForm').style.display = 'none';
        }

        function saveEdit() {
            const updates = {};
            data.columns.forEach((col, idx) => {
                updates[col] = document.getElementById('field_' + idx).value;
            });

            let messageData;
            if (dbType === 'mongodb') {
                messageData = {
                    command: 'edit',
                    connectionId,
                    resource,
                    schema,
                    data: {
                        id: data.rows[currentEditRow][0],
                        updates
                    }
                };
            } else if (dbType === 'redis') {
                messageData = {
                    command: 'edit',
                    connectionId,
                    resource,
                    schema,
                    data: {
                        key: data.rows[currentEditRow][0],
                        value: updates[data.columns[2]],
                        type: data.rows[currentEditRow][1]
                    }
                };
            } else {
                messageData = {
                    command: 'edit',
                    connectionId,
                    resource,
                    schema,
                    data: {
                        primaryKey: data.columns[0],
                        primaryKeyValue: data.rows[currentEditRow][0],
                        updates
                    }
                };
            }

            vscode.postMessage(messageData);
            closeEdit();
        }

        function deleteRow(rowIdx) {
            if (!confirm('Are you sure you want to delete this record?')) {
                return;
            }

            let messageData;
            if (dbType === 'mongodb') {
                messageData = {
                    command: 'delete',
                    connectionId,
                    resource,
                    schema,
                    data: { id: data.rows[rowIdx][0] }
                };
            } else if (dbType === 'redis') {
                messageData = {
                    command: 'delete',
                    connectionId,
                    resource,
                    schema,
                    data: { key: data.rows[rowIdx][0] }
                };
            } else {
                messageData = {
                    command: 'delete',
                    connectionId,
                    resource,
                    schema,
                    data: {
                        primaryKey: data.columns[0],
                        primaryKeyValue: data.rows[rowIdx][0]
                    }
                };
            }

            vscode.postMessage(messageData);
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        DataViewerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
