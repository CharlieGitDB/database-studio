import * as vscode from 'vscode';
import { DatabaseManager } from './databaseManager';
import { ConnectionManager } from './connectionManager';
import { QueryResult, ColumnInfo, QueryBuilderState, SavedQuery } from './types';
import { RedisClient } from './clients/redisClient';
import { MySQLClient } from './clients/mysqlClient';
import { PostgresClient } from './clients/postgresClient';
import { MongoDBClient } from './clients/mongoClient';
import { getMongoDBWebviewContent } from './mongoWebview';
import { QueryBuilder } from './queryBuilder';

export class DataViewerPanel {
    public static currentPanel: DataViewerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private currentSchema?: string;
    private extensionUri: vscode.Uri;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly databaseManager: DatabaseManager,
        private readonly connectionManager: ConnectionManager
    ) {
        this._panel = panel;
        this.extensionUri = extensionUri;

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
                    case 'executeQuery':
                        await this.executeQuery(message.connectionId, message.query, message.schema);
                        break;
                    case 'insertDocument':
                        await this.insertDocument(message.connectionId, message.resource, message.document);
                        break;
                    case 'executeAggregate':
                        await this.executeAggregate(message.connectionId, message.resource, message.pipeline);
                        break;
                    case 'getIndexes':
                        await this.getIndexes(message.connectionId, message.resource);
                        break;
                    case 'createIndex':
                        await this.createIndex(message.connectionId, message.resource, message.keys, message.options);
                        break;
                    case 'dropIndex':
                        await this.dropIndex(message.connectionId, message.resource, message.indexName);
                        break;
                    case 'getDocument':
                        await this.getDocument(message.connectionId, message.resource, message.id);
                        break;
                    case 'getColumns':
                        await this.getColumns(message.connectionId, message.resource, message.schema);
                        break;
                    case 'getTables':
                        await this.getTables(message.connectionId, message.schema);
                        break;
                    case 'generateSQL':
                        await this.generateSQL(message.builderState, message.dbType);
                        break;
                    case 'saveQuery':
                        await this.saveQuery(message.query);
                        break;
                    case 'loadQuery':
                        await this.loadQuery(message.queryId);
                        break;
                    case 'getSavedQueries':
                        await this.getSavedQueries(message.table);
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
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'src', 'webviews'),
                    extensionUri
                ]
            }
        );

        DataViewerPanel.currentPanel = new DataViewerPanel(panel, extensionUri, databaseManager, connectionManager);
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
            let defaultQuery: string | undefined;

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
                // Generate default SELECT query for MySQL
                defaultQuery = `SELECT * FROM ${resource} LIMIT 100;`;
            } else if (client instanceof PostgresClient) {
                data = await client.getTableData(resource, schema);
                // Generate default SELECT query for PostgreSQL with schema qualification
                const tableName = schema ? `"${schema}"."${resource}"` : `"${resource}"`;
                defaultQuery = `SELECT * FROM ${tableName} LIMIT 100;`;
            } else if (client instanceof MongoDBClient) {
                data = await client.getCollectionData(resource, schema);
            } else {
                this.showError('Unsupported database type');
                return;
            }

            this._panel.webview.html = this.getWebviewContent(data, connectionId, resource, config.type, schema, defaultQuery);
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
                await client.updateDocument(resource, data.id, data.updates, schema);
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
                await client.deleteDocument(resource, data.id, schema);
            }

            vscode.window.showInformationMessage('Record deleted successfully');
            await this.loadData(connectionId, resource, schema);
        } catch (error) {
            this.showError(`Failed to delete record: ${error}`);
        }
    }

    private async executeQuery(connectionId: string, query: string, schema?: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);
            const config = this.connectionManager.getConnection(connectionId);

            if (!client || !config) {
                this.showError('Connection not found');
                return;
            }

            let data: QueryResult;

            if (client instanceof PostgresClient) {
                // Set search_path to the schema if provided
                if (schema) {
                    await (client as any).client.query(`SET search_path TO "${schema}", public`);
                }
                data = await client.executeQuery(query);
            } else if (client instanceof MySQLClient) {
                data = await client.executeQuery(query);
            } else if (client instanceof MongoDBClient) {
                // For MongoDB, parse the query as JSON
                data = await client.executeQuery(schema || this.currentSchema || '', query, schema);
            } else {
                this.showError('Query execution not supported for this database type');
                return;
            }

            // Instead of replacing HTML, send results via message to preserve the UI
            this._panel.webview.postMessage({
                command: 'queryResults',
                columns: data.columns,
                rows: data.rows,
                rowCount: data.rows.length
            });
            vscode.window.showInformationMessage('Query executed successfully');
        } catch (error) {
            this.showError(`Failed to execute query: ${error}`);
        }
    }

    private async insertDocument(connectionId: string, resource: string, document: any) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client || !(client instanceof MongoDBClient)) {
                this.showError('Invalid client for MongoDB operation');
                return;
            }

            const docObj = JSON.parse(document);
            const insertedId = await client.insertDocument(resource, docObj, this.currentSchema);
            vscode.window.showInformationMessage(`Document inserted with ID: ${insertedId}`);
            await this.loadData(connectionId, resource, this.currentSchema);
        } catch (error) {
            this.showError(`Failed to insert document: ${error}`);
        }
    }

    private async executeAggregate(connectionId: string, resource: string, pipeline: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);
            const config = this.connectionManager.getConnection(connectionId);

            if (!client || !(client instanceof MongoDBClient) || !config) {
                this.showError('Invalid client for MongoDB operation');
                return;
            }

            const pipelineObj = JSON.parse(pipeline);
            const data = await client.aggregate(resource, pipelineObj, this.currentSchema);
            this._panel.webview.html = this.getWebviewContent(data, connectionId, resource, config.type, this.currentSchema, undefined);
            vscode.window.showInformationMessage('Aggregation pipeline executed successfully');
        } catch (error) {
            this.showError(`Failed to execute aggregation: ${error}`);
        }
    }

    private async getIndexes(connectionId: string, resource: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client || !(client instanceof MongoDBClient)) {
                this.showError('Invalid client for MongoDB operation');
                return;
            }

            const indexes = await client.getIndexes(resource, this.currentSchema);
            this._panel.webview.postMessage({ command: 'showIndexes', indexes });
        } catch (error) {
            this.showError(`Failed to get indexes: ${error}`);
        }
    }

    private async createIndex(connectionId: string, resource: string, keys: any, options: any) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client || !(client instanceof MongoDBClient)) {
                this.showError('Invalid client for MongoDB operation');
                return;
            }

            const keysObj = JSON.parse(keys);
            const optionsObj = options ? JSON.parse(options) : undefined;
            const indexName = await client.createIndex(resource, keysObj, optionsObj, this.currentSchema);
            vscode.window.showInformationMessage(`Index created: ${indexName}`);
            await this.getIndexes(connectionId, resource);
        } catch (error) {
            this.showError(`Failed to create index: ${error}`);
        }
    }

    private async dropIndex(connectionId: string, resource: string, indexName: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client || !(client instanceof MongoDBClient)) {
                this.showError('Invalid client for MongoDB operation');
                return;
            }

            await client.dropIndex(resource, indexName, this.currentSchema);
            vscode.window.showInformationMessage(`Index dropped: ${indexName}`);
            await this.getIndexes(connectionId, resource);
        } catch (error) {
            this.showError(`Failed to drop index: ${error}`);
        }
    }

    private async getDocument(connectionId: string, resource: string, id: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client || !(client instanceof MongoDBClient)) {
                this.showError('Invalid client for MongoDB operation');
                return;
            }

            const document = await client.getDocumentById(resource, id, this.currentSchema);
            this._panel.webview.postMessage({ command: 'showDocument', document });
        } catch (error) {
            this.showError(`Failed to get document: ${error}`);
        }
    }

    private async getColumns(connectionId: string, resource: string, schema?: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client) {
                this.showError('Connection not found');
                return;
            }

            let columns: ColumnInfo[] = [];

            if (client instanceof PostgresClient) {
                columns = await client.getColumns(resource, schema || 'public');
            } else if (client instanceof MySQLClient) {
                columns = await client.getColumns(resource);
            } else {
                this.showError('Column introspection not supported for this database type');
                return;
            }

            this._panel.webview.postMessage({ command: 'columnsData', columns });
        } catch (error) {
            this.showError(`Failed to get columns: ${error}`);
        }
    }

    private async getTables(connectionId: string, schema?: string) {
        try {
            const client = this.databaseManager.getClient(connectionId);

            if (!client) {
                this.showError('Connection not found');
                return;
            }

            let tables: string[] = [];

            if (client instanceof PostgresClient) {
                tables = await client.getTables(schema || 'public');
            } else if (client instanceof MySQLClient) {
                tables = await client.getTables();
            } else {
                this.showError('Table listing not supported for this database type');
                return;
            }

            this._panel.webview.postMessage({ command: 'tablesData', tables });
        } catch (error) {
            this.showError(`Failed to get tables: ${error}`);
        }
    }

    private async generateSQL(builderState: QueryBuilderState, dbType: 'mysql' | 'postgresql') {
        try {
            const sql = QueryBuilder.generateSQL(builderState, dbType);
            const validation = QueryBuilder.validate(builderState);

            this._panel.webview.postMessage({
                command: 'generatedSQL',
                sql,
                validation
            });
        } catch (error) {
            this.showError(`Failed to generate SQL: ${error}`);
        }
    }

    private async saveQuery(query: SavedQuery) {
        try {
            console.log('Backend: saveQuery called with:', query);

            // Get existing saved queries from global state
            const context = this.connectionManager.getContext();
            const savedQueries = context.globalState.get<SavedQuery[]>('savedQueries', []);
            console.log('Backend: Current saved queries:', savedQueries.length);

            // Add or update the query
            const existingIndex = savedQueries.findIndex(q => q.id === query.id);
            if (existingIndex >= 0) {
                console.log('Backend: Updating existing query at index', existingIndex);
                savedQueries[existingIndex] = { ...query, updatedAt: Date.now() };
            } else {
                console.log('Backend: Adding new query');
                savedQueries.push({ ...query, createdAt: Date.now(), updatedAt: Date.now() });
            }

            console.log('Backend: Saving queries to global state, total:', savedQueries.length);
            await context.globalState.update('savedQueries', savedQueries);
            vscode.window.showInformationMessage('Query saved successfully');

            console.log('Backend: Sending updated list to webview');
            // Send updated list back to webview
            this._panel.webview.postMessage({ command: 'savedQueriesList', queries: savedQueries });
        } catch (error) {
            console.error('Backend: Error saving query:', error);
            this.showError(`Failed to save query: ${error}`);
        }
    }

    private async loadQuery(queryId: string) {
        try {
            const context = this.connectionManager.getContext();
            const savedQueries = context.globalState.get<SavedQuery[]>('savedQueries', []);
            const query = savedQueries.find(q => q.id === queryId);

            if (query) {
                this._panel.webview.postMessage({ command: 'loadedQuery', query });
            } else {
                this.showError('Query not found');
            }
        } catch (error) {
            this.showError(`Failed to load query: ${error}`);
        }
    }

    private async getSavedQueries(table?: string) {
        try {
            const context = this.connectionManager.getContext();
            let savedQueries = context.globalState.get<SavedQuery[]>('savedQueries', []);

            // Filter queries by table if a table is specified
            if (table) {
                savedQueries = savedQueries.filter(query => query.state.table === table);
            }

            this._panel.webview.postMessage({ command: 'savedQueriesList', queries: savedQueries });
        } catch (error) {
            this.showError(`Failed to get saved queries: ${error}`);
        }
    }

    private showError(message: string) {
        vscode.window.showErrorMessage(message);
        this._panel.webview.html = `<html><body><h2>Error</h2><p>${message}</p></body></html>`;
    }

    private getQueryBuilderJSInline(): string {
        // Query Builder JavaScript - inlined for reliability
        return `
// Query Builder JavaScript Logic
let queryBuilderState = {
    table: '',
    schema: undefined,
    distinct: false,
    selectColumns: [],
    filters: [],
    joins: [],
    orderBy: [],
    groupBy: [],
    limit: undefined,
    offset: undefined
};

let columnsData = [];
let relatedTablesData = [];

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const tabContent = document.getElementById(tabName + 'Tab');
    const tabButton = document.querySelector(\`[data-tab="\${tabName}"]\`);

    if (tabContent) tabContent.classList.add('active');
    if (tabButton) tabButton.classList.add('active');

    if (tabName === 'queryBuilder' && resource && columnsData.length === 0) {
        vscode.postMessage({
            command: 'getColumns',
            connectionId,
            resource,
            schema
        });
    }
}

function toggleSection(titleElement) {
    titleElement.classList.toggle('collapsed');
}

function initializeQueryBuilder(tableName, schemaName) {
    queryBuilderState.table = tableName;
    queryBuilderState.schema = schemaName;

    if (schemaName) {
        document.getElementById('builderSchemaInfo').style.display = 'block';
        document.getElementById('builderSchemaName').textContent = schemaName;
    }

    // Request list of tables
    vscode.postMessage({
        command: 'getTables',
        connectionId,
        schema: schemaName
    });

    // Request saved queries filtered by current table
    vscode.postMessage({
        command: 'getSavedQueries',
        table: tableName
    });
}

function renderTables(tables, currentTable) {
    const tableSelector = document.getElementById('tableSelector');

    if (!tableSelector) {
        console.error('Table selector element not found');
        return;
    }

    if (!tables || tables.length === 0) {
        tableSelector.innerHTML = '<option value="">No tables found</option>';
        return;
    }

    console.log('Rendering tables:', tables, 'Current table:', currentTable);
    tableSelector.innerHTML = tables.map(table =>
        \`<option value="\${table}" \${table === currentTable ? 'selected' : ''}>\${table}</option>\`
    ).join('');
}

function changeTable() {
    const tableSelector = document.getElementById('tableSelector');
    const newTable = tableSelector.value;

    if (!newTable || newTable === queryBuilderState.table) {
        return;
    }

    // Reset the entire query builder state
    queryBuilderState = {
        table: newTable,
        schema: queryBuilderState.schema,
        distinct: false,
        selectColumns: [],
        filters: [],
        joins: [],
        orderBy: [],
        groupBy: [],
        limit: undefined,
        offset: undefined
    };

    // Clear all UI
    columnsData = [];
    relatedTablesData = [];
    document.getElementById('columnsList').innerHTML = '<p class="empty-state">Loading columns...</p>';
    document.getElementById('filtersList').innerHTML = '<p class="empty-state">No filters added. Click "+ Add Filter" to add conditions.</p>';
    document.getElementById('joinsList').innerHTML = '<p class="empty-state">No joins added. Click "+ Add Join" to join related tables.</p>';
    document.getElementById('orderByList').innerHTML = '<p class="empty-state">No sorting applied. Click "+ Add Sort" to order results.</p>';
    document.getElementById('sqlPreview').textContent = '';
    document.getElementById('distinctCheck').checked = false;
    document.getElementById('limitInput').value = '';
    document.getElementById('offsetInput').value = '0';

    // Request columns for the new table
    vscode.postMessage({
        command: 'getColumns',
        connectionId,
        resource: newTable,
        schema: queryBuilderState.schema
    });

    // Request saved queries filtered by new table
    vscode.postMessage({
        command: 'getSavedQueries',
        table: newTable
    });
}

function renderColumns(columns) {
    columnsData = columns;
    const columnsList = document.getElementById('columnsList');

    if (!columns || columns.length === 0) {
        columnsList.innerHTML = '<p class="empty-state">No columns found.</p>';
        return;
    }

    relatedTablesData = columns
        .filter(col => col.isForeignKey)
        .map(col => col.referencedTable)
        .filter((table, index, self) => self.indexOf(table) === index);

    if (relatedTablesData.length > 0) {
        document.getElementById('relatedTables').style.display = 'block';
        document.getElementById('relatedTablesList').textContent = relatedTablesData.join(', ');
    }

    columnsList.innerHTML = columns.map((col, index) => \`
        <div class="column-item" onclick="toggleColumnByClick(\${index}, event)">
            <input type="checkbox" id="col_\${index}" onchange="toggleColumn(\${index})" onclick="event.stopPropagation()">
            <div class="column-info">
                <div class="column-name">
                    \${col.name}
                    \${col.isPrimaryKey ? '<span class="column-badge">PK</span>' : ''}
                    \${col.isForeignKey ? \`<span class="column-badge" title="References \${col.referencedTable}.\${col.referencedColumn}">FK</span>\` : ''}
                </div>
                <div class="column-type">\${col.type}\${col.nullable ? ', nullable' : ''}</div>
                <div class="column-controls" id="controls_\${index}" style="display: none;" onclick="event.stopPropagation()">
                    <select onchange="setAggregate(\${index}, this.value)">
                        <option value="NONE">No aggregate</option>
                        <option value="COUNT">COUNT</option>
                        <option value="SUM">SUM</option>
                        <option value="AVG">AVG</option>
                        <option value="MIN">MIN</option>
                        <option value="MAX">MAX</option>
                    </select>
                    <input type="text" placeholder="Alias..." onchange="setAlias(\${index}, this.value)">
                </div>
            </div>
        </div>
    \`).join('');
}

function toggleColumn(index) {
    const checkbox = document.getElementById(\`col_\${index}\`);
    const controls = document.getElementById(\`controls_\${index}\`);
    const column = columnsData[index];

    if (checkbox.checked) {
        controls.style.display = 'flex';
        queryBuilderState.selectColumns.push({
            column: column.name,
            alias: undefined,
            aggregate: 'NONE'
        });
    } else {
        controls.style.display = 'none';
        queryBuilderState.selectColumns = queryBuilderState.selectColumns.filter(
            col => col.column !== column.name
        );
    }

    updateBuilder();
}

function toggleColumnByClick(index, event) {
    // Toggle the checkbox programmatically when clicking anywhere on the column item
    const checkbox = document.getElementById(\`col_\${index}\`);
    checkbox.checked = !checkbox.checked;

    // Trigger the change event to update the state
    toggleColumn(index);
}

function setAggregate(index, aggregate) {
    const column = columnsData[index];
    const selectCol = queryBuilderState.selectColumns.find(col => col.column === column.name);
    if (selectCol) {
        selectCol.aggregate = aggregate;
        updateBuilder();
    }
}

function setAlias(index, alias) {
    const column = columnsData[index];
    const selectCol = queryBuilderState.selectColumns.find(col => col.column === column.name);
    if (selectCol) {
        selectCol.alias = alias || undefined;
        updateBuilder();
    }
}

function selectAllColumns() {
    columnsData.forEach((col, index) => {
        const checkbox = document.getElementById(\`col_\${index}\`);
        if (!checkbox.checked) {
            checkbox.checked = true;
            toggleColumn(index);
        }
    });
}

function deselectAllColumns() {
    columnsData.forEach((col, index) => {
        const checkbox = document.getElementById(\`col_\${index}\`);
        if (checkbox.checked) {
            checkbox.checked = false;
            toggleColumn(index);
        }
    });
}

function addFilter() {
    queryBuilderState.filters.push({
        column: columnsData[0]?.name || '',
        operator: '=',
        value: '',
        logicalOperator: 'AND'
    });
    renderFilters();
    updateBuilder();
}

function renderFilters() {
    const filtersList = document.getElementById('filtersList');

    if (queryBuilderState.filters.length === 0) {
        filtersList.innerHTML = '<p class="empty-state">No filters added. Click "+ Add Filter" to add conditions.</p>';
        return;
    }

    filtersList.innerHTML = queryBuilderState.filters.map((filter, index) => \`
        <div class="filter-item">
            <select class="field-column" onchange="updateFilter(\${index}, 'column', this.value)">
                \${columnsData.map(col =>
                    \`<option value="\${col.name}" \${filter.column === col.name ? 'selected' : ''}>\${col.name}</option>\`
                ).join('')}
            </select>

            <select class="field-operator" onchange="updateFilter(\${index}, 'operator', this.value)">
                <option value="=" \${filter.operator === '=' ? 'selected' : ''}>=</option>
                <option value="!=" \${filter.operator === '!=' ? 'selected' : ''}>!=</option>
                <option value="<" \${filter.operator === '<' ? 'selected' : ''}>&lt;</option>
                <option value=">" \${filter.operator === '>' ? 'selected' : ''}>&gt;</option>
                <option value="<=" \${filter.operator === '<=' ? 'selected' : ''}>&lt;=</option>
                <option value=">=" \${filter.operator === '>=' ? 'selected' : ''}>&gt;=</option>
                <option value="LIKE" \${filter.operator === 'LIKE' ? 'selected' : ''}>LIKE</option>
                <option value="NOT LIKE" \${filter.operator === 'NOT LIKE' ? 'selected' : ''}>NOT LIKE</option>
                <option value="IN" \${filter.operator === 'IN' ? 'selected' : ''}>IN</option>
                <option value="NOT IN" \${filter.operator === 'NOT IN' ? 'selected' : ''}>NOT IN</option>
                <option value="IS NULL" \${filter.operator === 'IS NULL' ? 'selected' : ''}>IS NULL</option>
                <option value="IS NOT NULL" \${filter.operator === 'IS NOT NULL' ? 'selected' : ''}>IS NOT NULL</option>
            </select>

            <input class="field-value" type="text" value="\${filter.value}"
                onchange="updateFilter(\${index}, 'value', this.value)"
                placeholder="Value..."
                \${filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL' ? 'disabled' : ''}>

            \${index < queryBuilderState.filters.length - 1 ? \`
                <select class="field-logic" onchange="updateFilter(\${index}, 'logicalOperator', this.value)">
                    <option value="AND" \${filter.logicalOperator === 'AND' ? 'selected' : ''}>AND</option>
                    <option value="OR" \${filter.logicalOperator === 'OR' ? 'selected' : ''}>OR</option>
                </select>
            \` : ''}

            <button class="remove-btn" onclick="removeFilter(\${index})">Remove</button>
        </div>
    \`).join('');
}

function updateFilter(index, field, value) {
    if (queryBuilderState.filters[index]) {
        queryBuilderState.filters[index][field] = value;

        if (field === 'operator') {
            renderFilters();
        }

        updateBuilder();
    }
}

function removeFilter(index) {
    queryBuilderState.filters.splice(index, 1);
    renderFilters();
    updateBuilder();
}

function addJoin() {
    queryBuilderState.joins.push({
        table: relatedTablesData[0] || '',
        type: 'INNER',
        leftColumn: '',
        rightColumn: ''
    });
    renderJoins();
    updateBuilder();
}

function renderJoins() {
    const joinsList = document.getElementById('joinsList');

    if (queryBuilderState.joins.length === 0) {
        joinsList.innerHTML = '<p class="empty-state">No joins added. Click "+ Add Join" to join related tables.</p>';
        return;
    }

    joinsList.innerHTML = queryBuilderState.joins.map((join, index) => \`
        <div class="join-item">
            <select onchange="updateJoin(\${index}, 'type', this.value)">
                <option value="INNER" \${join.type === 'INNER' ? 'selected' : ''}>INNER JOIN</option>
                <option value="LEFT" \${join.type === 'LEFT' ? 'selected' : ''}>LEFT JOIN</option>
                <option value="RIGHT" \${join.type === 'RIGHT' ? 'selected' : ''}>RIGHT JOIN</option>
                <option value="FULL" \${join.type === 'FULL' ? 'selected' : ''}>FULL JOIN</option>
            </select>

            <input type="text" value="\${join.table}" onchange="updateJoin(\${index}, 'table', this.value)"
                placeholder="Table name..." style="min-width: 120px;">

            <span style="font-size: 12px;">ON</span>

            <input type="text" value="\${join.leftColumn}" onchange="updateJoin(\${index}, 'leftColumn', this.value)"
                placeholder="Left column..." style="min-width: 120px;">

            <span style="font-size: 12px;">=</span>

            <input type="text" value="\${join.rightColumn}" onchange="updateJoin(\${index}, 'rightColumn', this.value)"
                placeholder="Right column..." style="min-width: 120px;">

            <button class="remove-btn" onclick="removeJoin(\${index})">Remove</button>
        </div>
    \`).join('');
}

function updateJoin(index, field, value) {
    if (queryBuilderState.joins[index]) {
        queryBuilderState.joins[index][field] = value;
        updateBuilder();
    }
}

function removeJoin(index) {
    queryBuilderState.joins.splice(index, 1);
    renderJoins();
    updateBuilder();
}

function addOrderBy() {
    const priority = queryBuilderState.orderBy.length;
    queryBuilderState.orderBy.push({
        column: columnsData[0]?.name || '',
        direction: 'ASC',
        priority
    });
    renderOrderBy();
    updateBuilder();
}

function renderOrderBy() {
    const orderByList = document.getElementById('orderByList');

    if (queryBuilderState.orderBy.length === 0) {
        orderByList.innerHTML = '<p class="empty-state">No sorting applied. Click "+ Add Sort" to order results.</p>';
        return;
    }

    orderByList.innerHTML = queryBuilderState.orderBy.map((order, index) => \`
        <div class="orderby-item">
            <span style="font-size: 12px; min-width: 70px;">Priority \${order.priority + 1}:</span>

            <select onchange="updateOrderBy(\${index}, 'column', this.value)" style="min-width: 150px;">
                \${columnsData.map(col =>
                    \`<option value="\${col.name}" \${order.column === col.name ? 'selected' : ''}>\${col.name}</option>\`
                ).join('')}
            </select>

            <select onchange="updateOrderBy(\${index}, 'direction', this.value)">
                <option value="ASC" \${order.direction === 'ASC' ? 'selected' : ''}>Ascending (A-Z)</option>
                <option value="DESC" \${order.direction === 'DESC' ? 'selected' : ''}>Descending (Z-A)</option>
            </select>

            <button class="remove-btn" onclick="removeOrderBy(\${index})">Remove</button>
        </div>
    \`).join('');
}

function updateOrderBy(index, field, value) {
    if (queryBuilderState.orderBy[index]) {
        queryBuilderState.orderBy[index][field] = value;
        updateBuilder();
    }
}

function removeOrderBy(index) {
    queryBuilderState.orderBy.splice(index, 1);
    queryBuilderState.orderBy.forEach((order, i) => {
        order.priority = i;
    });
    renderOrderBy();
    updateBuilder();
}

function updateBuilder() {
    queryBuilderState.distinct = document.getElementById('distinctCheck')?.checked || false;

    const limitValue = document.getElementById('limitInput')?.value;
    queryBuilderState.limit = limitValue ? parseInt(limitValue) : undefined;

    const offsetValue = document.getElementById('offsetInput')?.value;
    queryBuilderState.offset = offsetValue ? parseInt(offsetValue) : undefined;

    vscode.postMessage({
        command: 'generateSQL',
        builderState: queryBuilderState,
        dbType: dbType
    });
}

function displayGeneratedSQL(sql, validation) {
    const sqlPreview = document.getElementById('sqlPreview');
    const validationErrors = document.getElementById('validationErrors');

    sqlPreview.textContent = sql;

    if (!validation.valid) {
        validationErrors.style.display = 'block';
        validationErrors.innerHTML = '<strong>Validation Errors:</strong><ul>' +
            validation.errors.map(err => \`<li>\${err}</li>\`).join('') +
            '</ul>';
    } else {
        validationErrors.style.display = 'none';
    }
}

function copySQL() {
    const sql = document.getElementById('sqlPreview').textContent;
    navigator.clipboard.writeText(sql).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

function executeBuilderQuery() {
    const sql = document.getElementById('sqlPreview').textContent;
    if (!sql || sql.trim() === '') {
        alert('Please build a query first');
        return;
    }

    if (editor) {
        editor.setValue(sql);
    }
    vscode.postMessage({ command: 'executeQuery', connectionId, query: sql, schema });
}

function saveCurrentQuery() {
    const sql = document.getElementById('sqlPreview').textContent;
    console.log('Save query clicked, SQL:', sql);

    if (!sql || sql.trim() === '') {
        alert('Please build a query first');
        return;
    }

    // Open modal
    const modal = document.getElementById('saveQueryModal');
    modal.classList.add('active');

    // Clear previous values
    document.getElementById('queryNameInput').value = '';
    document.getElementById('queryDescInput').value = '';

    // Focus on name input
    setTimeout(() => {
        document.getElementById('queryNameInput').focus();
    }, 100);
}

function closeSaveQueryModal() {
    const modal = document.getElementById('saveQueryModal');
    modal.classList.remove('active');
}

function confirmSaveQuery() {
    const name = document.getElementById('queryNameInput').value.trim();
    const description = document.getElementById('queryDescInput').value.trim();
    const sql = document.getElementById('sqlPreview').textContent;

    console.log('Query name entered:', name);
    console.log('Query description entered:', description);

    if (!name) {
        alert('Please enter a query name');
        return;
    }

    const savedQuery = {
        id: Date.now().toString(),
        name,
        description: description || undefined,
        state: JSON.parse(JSON.stringify(queryBuilderState)),
        sql,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    console.log('Sending saveQuery message:', savedQuery);
    vscode.postMessage({
        command: 'saveQuery',
        query: savedQuery
    });

    closeSaveQueryModal();
}

function renderSavedQueries(queries) {
    console.log('renderSavedQueries called with:', queries);
    const savedQueriesList = document.getElementById('savedQueriesList');

    if (!queries || queries.length === 0) {
        console.log('No queries to render');
        savedQueriesList.innerHTML = '<p class="empty-state">No saved queries yet.</p>';
        return;
    }

    console.log('Rendering', queries.length, 'queries');
    savedQueriesList.innerHTML = queries.map(query => \`
        <div class="saved-query-item" onclick="loadSavedQuery('\${query.id}')">
            <div class="saved-query-name">\${query.name}</div>
            \${query.description ? \`<div class="saved-query-desc">\${query.description}</div>\` : ''}
            <div class="saved-query-sql">\${query.sql}</div>
        </div>
    \`).join('');
}

function loadSavedQuery(queryId) {
    vscode.postMessage({
        command: 'loadQuery',
        queryId
    });
}

function applyLoadedQuery(query) {
    queryBuilderState = JSON.parse(JSON.stringify(query.state));

    document.getElementById('distinctCheck').checked = queryBuilderState.distinct;
    document.getElementById('limitInput').value = queryBuilderState.limit || '';
    document.getElementById('offsetInput').value = queryBuilderState.offset || 0;

    columnsData.forEach((col, index) => {
        const checkbox = document.getElementById(\`col_\${index}\`);
        const controls = document.getElementById(\`controls_\${index}\`);
        const selectCol = queryBuilderState.selectColumns.find(sc => sc.column === col.name);

        if (selectCol) {
            checkbox.checked = true;
            controls.style.display = 'flex';

            const aggregateSelect = controls.querySelector('select');
            const aliasInput = controls.querySelector('input');
            if (aggregateSelect) aggregateSelect.value = selectCol.aggregate;
            if (aliasInput) aliasInput.value = selectCol.alias || '';
        } else {
            checkbox.checked = false;
            controls.style.display = 'none';
        }
    });

    renderFilters();
    renderJoins();
    renderOrderBy();
    updateBuilder();

    // Query loaded successfully - no alert needed since it's filtered by table
}

window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'tablesData':
            renderTables(message.tables, queryBuilderState.table);
            break;
        case 'columnsData':
            renderColumns(message.columns);
            break;
        case 'generatedSQL':
            displayGeneratedSQL(message.sql, message.validation);
            break;
        case 'savedQueriesList':
            renderSavedQueries(message.queries);
            break;
        case 'loadedQuery':
            applyLoadedQuery(message.query);
            break;
    }
});
`;
    }

    private getWebviewContent(data: QueryResult, connectionId: string, resource: string, dbType: string, schema?: string, previousQuery?: string): string {
        // Use MongoDB-specific UI for MongoDB databases
        if (dbType === 'mongodb' && resource) {
            return getMongoDBWebviewContent(this.extensionUri, this._panel.webview, data, connectionId, resource, schema);
        }

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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/monokai.min.css">
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
            max-height: 80vh;
            overflow-y: auto;
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
        .query-container {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            background: var(--vscode-editor-background);
        }
        .query-editor-wrapper {
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            overflow: hidden;
        }
        .CodeMirror {
            height: auto;
            min-height: 120px;
            max-height: 400px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
        }
        .query-actions {
            margin-top: 8px;
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .query-hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-left: auto;
        }
        .results-header {
            margin-top: 20px;
            margin-bottom: 10px;
            padding: 10px;
            background-color: var(--vscode-editor-selectionBackground);
            border-left: 3px solid var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .results-title {
            font-size: 14px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        .results-subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-left: 10px;
        }

        /* Query Builder Styles */
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 15px;
            gap: 2px;
        }
        .tab {
            padding: 10px 20px;
            background-color: var(--vscode-tab-inactiveBackground);
            color: var(--vscode-tab-inactiveForeground);
            border: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            transition: all 0.2s;
        }
        .tab:hover {
            background-color: var(--vscode-tab-hoverBackground);
        }
        .tab.active {
            background-color: var(--vscode-tab-activeBackground);
            color: var(--vscode-tab-activeForeground);
            border-bottom-color: var(--vscode-textLink-foreground);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .builder-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 14px;
        }
        .builder-section {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            background-color: var(--vscode-editor-background);
            overflow: hidden;
        }
        .builder-section.full-width {
            grid-column: 1 / -1;
        }
        .section-title {
            margin: 0;
            padding: 6px 10px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
        }
        .section-title:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .section-toggle {
            font-size: 10px;
            margin-right: 4px;
            transition: transform 0.2s;
        }
        .section-title.collapsed .section-toggle {
            transform: rotate(-90deg);
        }
        .section-content {
            padding: 8px;
            max-height: 400px;
            overflow-y: auto;
        }
        .section-title.collapsed + .section-content {
            display: none;
        }
        .columns-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 4px;
        }
        .column-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 6px 10px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background-color: var(--vscode-input-background);
            font-size: 13px;
            cursor: pointer;
            user-select: none;
        }
        .column-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .column-item input[type="checkbox"] {
            margin: 3px 0 0 0;
        }
        .column-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .column-name {
            font-weight: 500;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 13px;
        }
        .column-type {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .column-badge {
            font-size: 10px;
            padding: 2px 5px;
            border-radius: 2px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .column-controls {
            display: flex;
            gap: 6px;
            align-items: center;
            flex-wrap: wrap;
            margin-top: 4px;
        }
        .column-controls select,
        .column-controls input {
            font-size: 12px;
            padding: 4px 6px;
            min-width: 70px;
            flex: 1;
        }
        .column-controls select {
            min-width: 110px;
        }
        .filters-list, .joins-list, .orderby-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .filter-item, .join-item, .orderby-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background-color: var(--vscode-input-background);
            flex-wrap: wrap;
            font-size: 13px;
        }
        .filter-item select,
        .filter-item input,
        .join-item select,
        .orderby-item select {
            padding: 5px 7px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 2px;
            font-size: 13px;
        }
        .filter-item .field-column {
            min-width: 100px;
            flex: 1;
        }
        .filter-item .field-operator {
            min-width: 80px;
        }
        .filter-item .field-value {
            flex: 2;
            min-width: 100px;
        }
        .filter-item .field-logic {
            min-width: 60px;
        }
        .remove-btn {
            padding: 4px 8px;
            background-color: transparent;
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .remove-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        .action-btn-small {
            padding: 4px 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .action-btn-small:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .action-btn-small.push-right {
            margin-left: auto;
        }
        .action-btn {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }
        .action-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .action-btn.primary-btn {
            background-color: var(--vscode-button-background);
            font-weight: 600;
        }
        .limit-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: flex-end;
        }
        .control-group {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .control-group label {
            font-size: 12px;
            font-weight: 500;
        }
        .control-group input {
            padding: 5px 7px;
            width: 100px;
            font-size: 13px;
        }
        .sql-preview-section {
            position: sticky;
            bottom: 0;
            z-index: 10;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        }
        .sql-preview-code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-editor-foreground);
            padding: 12px;
            border-radius: 2px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-input-border);
        }
        .validation-errors {
            margin-top: 8px;
            padding: 10px 12px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 2px;
            color: var(--vscode-errorForeground);
            font-size: 12px;
        }
        .validation-errors ul {
            margin: 5px 0;
            padding-left: 20px;
        }
        .empty-state {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            font-style: italic;
            margin: 0;
        }
        .saved-queries-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .saved-query-item {
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background-color: var(--vscode-input-background);
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .saved-query-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .saved-query-name {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
        }
        .saved-query-desc {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        .saved-query-sql {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .info-row {
            margin: 5px 0;
            font-size: 13px;
        }
        .related-tables {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
        }
        /* Modal styles */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        .modal-overlay.active {
            display: flex;
        }
        .modal-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 20px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .modal-header {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-foreground);
        }
        .modal-body {
            margin-bottom: 16px;
        }
        .modal-input {
            width: 100%;
            padding: 8px;
            margin-bottom: 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            box-sizing: border-box;
        }
        .modal-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .modal-label {
            display: block;
            margin-bottom: 4px;
            font-size: 12px;
            color: var(--vscode-foreground);
        }
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .modal-btn {
            padding: 6px 14px;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .modal-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .modal-btn.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .modal-btn.primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h2>${resource || 'Query Results'}</h2>

    ${dbType !== 'mongodb' && dbType !== 'redis' && resource ? `
    <!-- Tabs -->
    <div class="tabs">
        <button class="tab active" data-tab="sqlEditor" onclick="switchTab('sqlEditor')">SQL Editor</button>
        <button class="tab" data-tab="queryBuilder" onclick="switchTab('queryBuilder')">Query Builder</button>
    </div>

    <!-- SQL Editor Tab -->
    <div id="sqlEditorTab" class="tab-content active">
        <div class="query-container">
            <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 14px; color: var(--vscode-foreground);">SQL Query Editor</h3>
            <p style="margin: 0 0 10px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">
                ${schema ? `Query any table in the <strong>${schema}</strong> schema. You can reference tables without schema prefix.` : 'Execute custom SQL queries against the database.'}
            </p>
            <div class="query-editor-wrapper">
                <textarea
                    class="query-editor"
                    id="sqlQuery"
                    placeholder="-- Enter SQL query here&#x0a;-- Example: SELECT * FROM ${resource || 'table_name'} WHERE id > 10 LIMIT 50${schema ? '&#x0a;-- You can query any table in this schema without the schema prefix' : ''}"
                    spellcheck="false"
                >${previousQuery || ''}</textarea>
            </div>
            <div class="query-actions">
                <button onclick="executeQuery()">▶ Execute Query</button>
                ${resource ? '<button onclick="refresh()">🔄 Refresh Table</button>' : ''}
                <span class="query-hint">Ctrl+Enter or Cmd+Enter to execute</span>
            </div>
        </div>
    </div>

    <!-- Query Builder Tab Content -->
    <div id="queryBuilderTab" class="tab-content">
        <div class="builder-container">
            <!-- Saved Queries Section -->
            <div class="builder-section full-width">
                <h4 class="section-title collapsed" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    Saved Queries
                    <button class="action-btn-small push-right" onclick="event.stopPropagation(); saveCurrentQuery()">💾 Save</button>
                </h4>
                <div class="section-content">
                    <div id="savedQueriesList" class="saved-queries-list">
                        <p class="empty-state">No saved queries</p>
                    </div>
                </div>
            </div>

            <!-- Table Selection Section -->
            <div class="builder-section full-width">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    Table: <select id="tableSelector" onchange="changeTable()" onclick="event.stopPropagation()" style="padding: 2px 6px; font-size: 12px; margin-left: 6px;">
                        <option value="">Loading tables...</option>
                    </select>
                    <span id="builderSchemaInfo" style="display: none; margin-left: 10px; font-weight: normal; font-size: 11px;">Schema: <strong id="builderSchemaName"></strong></span>
                </h4>
            </div>

            <!-- Column Selection Section -->
            <div class="builder-section full-width">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    Columns
                    <button class="action-btn-small" onclick="event.stopPropagation(); selectAllColumns()" style="margin-left: 10px;">All</button>
                    <button class="action-btn-small" onclick="event.stopPropagation(); deselectAllColumns()">None</button>
                    <label style="font-weight: normal; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                        <input type="checkbox" id="distinctCheck" onchange="updateBuilder()" onclick="event.stopPropagation()">
                        DISTINCT
                    </label>
                </h4>
                <div class="section-content">
                    <div id="columnsList" class="columns-list"></div>
                </div>
            </div>

            <!-- WHERE Conditions Section -->
            <div class="builder-section">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    WHERE
                    <button class="action-btn-small push-right" onclick="event.stopPropagation(); addFilter()">+ Add</button>
                </h4>
                <div class="section-content">
                    <div id="filtersList" class="filters-list">
                        <p class="empty-state">No filters</p>
                    </div>
                </div>
            </div>

            <!-- JOIN Section -->
            <div class="builder-section">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    JOIN
                    <button class="action-btn-small push-right" onclick="event.stopPropagation(); addJoin()">+ Add</button>
                </h4>
                <div class="section-content">
                    <div id="joinsList" class="joins-list">
                        <p class="empty-state">No joins</p>
                    </div>
                    <div id="relatedTables" class="related-tables" style="display: none;">
                        <p style="font-size: 10px; color: var(--vscode-descriptionForeground); margin: 3px 0;">
                            <strong>Related:</strong> <span id="relatedTablesList"></span>
                        </p>
                    </div>
                </div>
            </div>

            <!-- ORDER BY Section -->
            <div class="builder-section">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    ORDER BY
                    <button class="action-btn-small push-right" onclick="event.stopPropagation(); addOrderBy()">+ Add</button>
                </h4>
                <div class="section-content">
                    <div id="orderByList" class="orderby-list">
                        <p class="empty-state">No sorting</p>
                    </div>
                </div>
            </div>

            <!-- LIMIT/OFFSET Section -->
            <div class="builder-section">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    LIMIT & OFFSET
                </h4>
                <div class="section-content">
                    <div class="limit-controls">
                        <div class="control-group">
                            <label for="limitInput">LIMIT:</label>
                            <input type="number" id="limitInput" min="0" step="1" placeholder="All" onchange="updateBuilder()">
                        </div>
                        <div class="control-group">
                            <label for="offsetInput">OFFSET:</label>
                            <input type="number" id="offsetInput" min="0" step="1" value="0" onchange="updateBuilder()">
                        </div>
                    </div>
                </div>
            </div>

            <!-- SQL Preview Section -->
            <div class="builder-section full-width sql-preview-section">
                <h4 class="section-title" onclick="toggleSection(this)">
                    <span class="section-toggle">▼</span>
                    SQL Preview
                    <div style="margin-left: auto; display: flex; gap: 6px;">
                        <button class="action-btn" onclick="event.stopPropagation(); copySQL()">📋 Copy</button>
                        <button class="action-btn primary-btn" onclick="event.stopPropagation(); executeBuilderQuery()">▶ Run</button>
                    </div>
                </h4>
                <div class="section-content">
                    <div id="sqlPreview" class="sql-preview-code"></div>
                    <div id="validationErrors" class="validation-errors" style="display: none;"></div>
                </div>
            </div>
        </div>
    </div>
    ` : dbType !== 'mongodb' && dbType !== 'redis' ? `
    <div class="query-container">
        <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 14px; color: var(--vscode-foreground);">SQL Query Editor</h3>
        <p style="margin: 0 0 10px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">
            Execute custom SQL queries against the database.
        </p>
        <div class="query-editor-wrapper">
            <textarea
                class="query-editor"
                id="sqlQuery"
                placeholder="-- Enter SQL query here"
                spellcheck="false"
            >${previousQuery || ''}</textarea>
        </div>
        <div class="query-actions">
            <button onclick="executeQuery()">▶ Execute Query</button>
            <span class="query-hint">Ctrl+Enter or Cmd+Enter to execute</span>
        </div>
    </div>
    ` : ''}

    <div id="resultsContainer">
        ${resource ? `
        <div class="results-header">
            <div>
                <span class="results-title">Results: ${schema ? schema + '.' : ''}${resource}</span>
                <span class="results-subtitle" id="rowCount">${data.rows.length} row${data.rows.length !== 1 ? 's' : ''}</span>
            </div>
            <button onclick="refresh()">🔄 Refresh</button>
        </div>
        ` : `
        <div class="results-header">
            <div>
                <span class="results-title">Query Results</span>
                <span class="results-subtitle" id="rowCount">${data.rows.length} row${data.rows.length !== 1 ? 's' : ''}</span>
            </div>
        </div>
        `}

        <table id="resultsTable">
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
    </div>

    <div class="overlay" id="overlay"></div>
    <div class="edit-form" id="editForm">
        <h3>Edit Record</h3>
        <div id="editFields"></div>
        <button onclick="saveEdit()">Save</button>
        <button onclick="closeEdit()">Cancel</button>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/sql/sql.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        const data = ${JSON.stringify({ columns: data.columns, rows })};
        const connectionId = '${connectionId}';
        const resource = '${resource}';
        const dbType = '${dbType}';
        const schema = ${schema ? `'${schema}'` : 'undefined'};
        let currentEditRow = null;
        let editor = null;

        // Initialize CodeMirror only for SQL databases
        if (dbType !== 'mongodb' && dbType !== 'redis') {
            const sqlQueryElement = document.getElementById('sqlQuery');
            if (sqlQueryElement) {
                editor = CodeMirror.fromTextArea(sqlQueryElement, {
                    mode: 'text/x-sql',
                    theme: 'monokai',
                    lineNumbers: true,
                    lineWrapping: true,
                    indentUnit: 4,
                    smartIndent: true,
                    extraKeys: {
                        'Ctrl-Enter': function(cm) {
                            executeQuery();
                        },
                        'Cmd-Enter': function(cm) {
                            executeQuery();
                        }
                    }
                });
            }
        }

        function executeQuery() {
            if (!editor) {
                return;
            }
            const query = editor.getValue().trim();
            if (!query) {
                alert('Please enter a SQL query');
                return;
            }
            vscode.postMessage({ command: 'executeQuery', connectionId, query, schema });
        }

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

        function updateQueryResults(columns, rows, rowCount) {
            // Update the data object
            data.columns = columns;
            data.rows = rows;

            // Update row count
            const rowCountElement = document.getElementById('rowCount');
            if (rowCountElement) {
                rowCountElement.textContent = rowCount + ' row' + (rowCount !== 1 ? 's' : '');
            }

            // Update table
            const table = document.getElementById('resultsTable');
            if (table) {
                // Update header
                const thead = table.querySelector('thead tr');
                if (thead) {
                    thead.innerHTML = columns.map(col => \`<th>\${col}</th>\`).join('') + '<th>Actions</th>';
                }

                // Update body
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    tbody.innerHTML = rows.map((row, rowIdx) => \`
                        <tr>
                            \${row.map(cell => {
                                const value = typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
                                return \`<td>\${value}</td>\`;
                            }).join('')}
                            <td>
                                <button onclick="editRow(\${rowIdx})">Edit</button>
                                <button onclick="deleteRow(\${rowIdx})">Delete</button>
                            </td>
                        </tr>
                    \`).join('');
                }
            }

            // Switch to SQL Editor tab to show results
            const sqlEditorTab = document.querySelector('[data-tab="sqlEditor"]');
            if (sqlEditorTab) {
                switchTab('sqlEditor');
            }
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

        // Listen for query results to update the table without destroying the page
        window.addEventListener('message', event => {
            const message = event.data;

            if (message.command === 'queryResults') {
                updateQueryResults(message.columns, message.rows, message.rowCount);
            }
        });

    </script>
    ${resource ? `<script>${this.getQueryBuilderJSInline()}</script>` : ''}
    ${resource ? `<script>
        // Initialize query builder after the functions are loaded
        if (typeof initializeQueryBuilder === 'function') {
            initializeQueryBuilder('${resource}', ${schema ? `'${schema}'` : 'undefined'});
        }
    </script>` : ''}

    <!-- Save Query Modal -->
    <div id="saveQueryModal" class="modal-overlay" onclick="if(event.target === this) closeSaveQueryModal()">
        <div class="modal-content">
            <div class="modal-header">Save Query</div>
            <div class="modal-body">
                <label class="modal-label" for="queryNameInput">Query Name *</label>
                <input type="text" id="queryNameInput" class="modal-input" placeholder="e.g., Get all active users"
                    onkeydown="if(event.key === 'Enter') confirmSaveQuery(); if(event.key === 'Escape') closeSaveQueryModal();" />

                <label class="modal-label" for="queryDescInput">Description (optional)</label>
                <input type="text" id="queryDescInput" class="modal-input" placeholder="e.g., Retrieves all users with active status"
                    onkeydown="if(event.key === 'Enter') confirmSaveQuery(); if(event.key === 'Escape') closeSaveQueryModal();" />
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="closeSaveQueryModal()">Cancel</button>
                <button class="modal-btn primary" onclick="confirmSaveQuery()">Save</button>
            </div>
        </div>
    </div>
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
