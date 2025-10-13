import { QueryResult } from './types';

export function getMongoDBWebviewContent(
    data: QueryResult,
    connectionId: string,
    resource: string,
    schema?: string
): string {
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
    <title>MongoDB Viewer - ${resource}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/monokai.min.css">
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            overflow-x: hidden;
        }
        .container {
            padding: 20px;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        h2 {
            margin: 0;
            font-size: 18px;
        }
        .tabs {
            display: flex;
            gap: 2px;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 15px;
        }
        .tab {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px 4px 0 0;
            font-size: 13px;
            transition: background 0.2s;
        }
        .tab:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .tab.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .button-group {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 7px 14px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 13px;
            transition: background 0.2s;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        button.danger {
            background-color: #d32f2f;
        }
        button.danger:hover {
            background-color: #b71c1c;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 13px;
        }
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        th {
            background-color: var(--vscode-editor-selectionBackground);
            font-weight: bold;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        td.expandable {
            cursor: pointer;
            color: var(--vscode-textLink-foreground);
        }
        td.expandable:hover {
            text-decoration: underline;
        }
        .query-builder {
            display: grid;
            gap: 10px;
            margin-bottom: 15px;
        }
        .query-builder-row {
            display: grid;
            grid-template-columns: 150px 120px 1fr 40px;
            gap: 8px;
            align-items: center;
        }
        .editor-wrapper {
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .CodeMirror {
            height: auto;
            min-height: 80px;
            max-height: 400px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
        }
        input, select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 3px;
            font-size: 13px;
            width: 100%;
        }
        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-size: 12px;
            font-weight: 500;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 999;
        }
        .modal {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            z-index: 1000;
            max-width: 700px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
        }
        .modal h3 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
        }
        .hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 5px;
        }
        .index-list {
            list-style: none;
            padding: 0;
        }
        .index-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 8px;
            background: var(--vscode-input-background);
        }
        .index-name {
            font-weight: 500;
        }
        .index-keys {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 3px;
        }
        .query-examples {
            margin-top: 10px;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 3px;
        }
        .query-examples h4 {
            margin: 0 0 10px 0;
            font-size: 13px;
        }
        .query-examples pre {
            margin: 5px 0;
            padding: 8px;
            background: var(--vscode-editor-background);
            border-radius: 3px;
            font-size: 12px;
            overflow-x: auto;
        }
        .quick-filter {
            margin-bottom: 15px;
        }
        .quick-filter input {
            width: 100%;
            padding: 8px 12px;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .action-buttons {
            display: flex;
            gap: 4px;
        }
        .action-buttons button {
            padding: 4px 8px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📊 ${resource}</h2>
            <div class="stats">
                <span>Documents: <strong id="docCount">${data.rows.length}</strong></span>
                <span>Fields: <strong>${data.columns.length}</strong></span>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" data-tab="documents">Documents</button>
            <button class="tab" data-tab="query">Query Builder</button>
            <button class="tab" data-tab="aggregate">Aggregation</button>
            <button class="tab" data-tab="indexes">Indexes</button>
        </div>

        <!-- Documents Tab -->
        <div id="tab-documents" class="tab-content active">
            <div class="button-group">
                <button onclick="showInsertDialog()">➕ Insert Document</button>
                <button class="secondary" onclick="refresh()">🔄 Refresh</button>
                <button class="secondary" onclick="exportToJSON()">💾 Export JSON</button>
            </div>

            <div class="quick-filter">
                <input type="text" id="quickFilter" placeholder="Quick filter (press Enter to search)..." onkeypress="if(event.key==='Enter') applyQuickFilter()">
            </div>

            <div style="overflow-x: auto;">
                <table id="dataTable">
                    <thead>
                        <tr>
                            ${data.columns.map(col => `<th>${col}</th>`).join('')}
                            <th style="width: 140px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((row, rowIdx) => `
                            <tr data-row-id="${rowIdx}">
                                ${row.map((cell, cellIdx) => {
                                    const isJSON = cell.startsWith('{') || cell.startsWith('[');
                                    return `<td class="${isJSON ? 'expandable' : ''}" onclick="${isJSON ? `showJSON(${rowIdx}, ${cellIdx})` : ''}" title="${cell}">${cell}</td>`;
                                }).join('')}
                                <td>
                                    <div class="action-buttons">
                                        <button onclick="viewDocument(${rowIdx})">👁️</button>
                                        <button onclick="editDocument(${rowIdx})">✏️</button>
                                        <button class="danger" onclick="deleteRow(${rowIdx})">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Query Builder Tab -->
        <div id="tab-query" class="tab-content">
            <div class="form-group">
                <label>MongoDB Query (JSON)</label>
                <div class="editor-wrapper">
                    <textarea id="queryEditor" placeholder='{"field": "value"}'></textarea>
                </div>
                <p class="hint">Enter a MongoDB query as JSON. Ctrl+Enter to execute.</p>
            </div>

            <div class="button-group">
                <button onclick="executeMongoQuery()">▶ Execute Query</button>
                <button class="secondary" onclick="clearQuery()">Clear</button>
            </div>

            <div class="query-examples">
                <h4>📖 Query Examples:</h4>
                <pre>// Find by exact match
{"name": "John Doe"}</pre>
                <pre>// Find with comparison
{"age": {"$gt": 25}}</pre>
                <pre>// Find with logical operators
{"$or": [{"status": "active"}, {"priority": "high"}]}</pre>
                <pre>// Find with regex
{"email": {"$regex": "@gmail\\\\.com$"}}</pre>
                <pre>// Find nested fields
{"address.city": "New York"}</pre>
            </div>
        </div>

        <!-- Aggregation Tab -->
        <div id="tab-aggregate" class="tab-content">
            <div class="form-group">
                <label>Aggregation Pipeline (JSON Array)</label>
                <div class="editor-wrapper">
                    <textarea id="aggregateEditor" placeholder='[{"$match": {}}, {"$group": {}}]'></textarea>
                </div>
                <p class="hint">Enter an aggregation pipeline as a JSON array. Ctrl+Enter to execute.</p>
            </div>

            <div class="button-group">
                <button onclick="executeAggregation()">▶ Execute Pipeline</button>
                <button class="secondary" onclick="clearAggregate()">Clear</button>
            </div>

            <div class="query-examples">
                <h4>📖 Aggregation Examples:</h4>
                <pre>// Group and count
[{"$group": {"_id": "$status", "count": {"$sum": 1}}}]</pre>
                <pre>// Match and sort
[{"$match": {"active": true}}, {"$sort": {"createdAt": -1}}]</pre>
                <pre>// Lookup (join)
[{"$lookup": {"from": "orders", "localField": "_id", "foreignField": "userId", "as": "userOrders"}}]</pre>
                <pre>// Project specific fields
[{"$project": {"name": 1, "email": 1, "age": 1}}]</pre>
            </div>
        </div>

        <!-- Indexes Tab -->
        <div id="tab-indexes" class="tab-content">
            <div class="button-group">
                <button onclick="showCreateIndexDialog()">➕ Create Index</button>
                <button class="secondary" onclick="loadIndexes()">🔄 Refresh Indexes</button>
            </div>

            <ul class="index-list" id="indexList">
                <li style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);">
                    Click "Refresh Indexes" to load indexes
                </li>
            </ul>
        </div>
    </div>

    <!-- Modals -->
    <div class="overlay" id="overlay" onclick="closeAllModals()"></div>

    <!-- Insert Document Modal -->
    <div class="modal" id="insertModal">
        <h3>Insert New Document</h3>
        <div class="form-group">
            <label>Document JSON</label>
            <div class="editor-wrapper">
                <textarea id="insertEditor" placeholder='{"field": "value", "number": 123}'></textarea>
            </div>
            <p class="hint">Enter the document as JSON. The _id will be generated automatically if not provided.</p>
        </div>
        <div class="modal-actions">
            <button onclick="insertDocument()">Insert</button>
            <button class="secondary" onclick="closeAllModals()">Cancel</button>
        </div>
    </div>

    <!-- Edit Document Modal -->
    <div class="modal" id="editModal">
        <h3>Edit Document</h3>
        <div class="form-group">
            <label>Document JSON</label>
            <div class="editor-wrapper">
                <textarea id="editEditor"></textarea>
            </div>
            <p class="hint">Modify the document fields. The _id cannot be changed.</p>
        </div>
        <div class="modal-actions">
            <button onclick="saveEdit()">Save</button>
            <button class="secondary" onclick="closeAllModals()">Cancel</button>
        </div>
    </div>

    <!-- View Document Modal -->
    <div class="modal" id="viewModal">
        <h3>View Document</h3>
        <div class="form-group">
            <div class="editor-wrapper">
                <textarea id="viewEditor" readonly></textarea>
            </div>
        </div>
        <div class="modal-actions">
            <button class="secondary" onclick="closeAllModals()">Close</button>
        </div>
    </div>

    <!-- Create Index Modal -->
    <div class="modal" id="createIndexModal">
        <h3>Create Index</h3>
        <div class="form-group">
            <label>Index Keys (JSON)</label>
            <input type="text" id="indexKeys" placeholder='{"fieldName": 1}'>
            <p class="hint">Use 1 for ascending, -1 for descending. Example: {"email": 1, "createdAt": -1}</p>
        </div>
        <div class="form-group">
            <label>Index Options (JSON, Optional)</label>
            <input type="text" id="indexOptions" placeholder='{"unique": true, "name": "email_idx"}'>
            <p class="hint">Optional. Examples: {"unique": true}, {"sparse": true}, {"name": "custom_name"}</p>
        </div>
        <div class="modal-actions">
            <button onclick="createIndex()">Create</button>
            <button class="secondary" onclick="closeAllModals()">Cancel</button>
        </div>
    </div>

    <!-- JSON View Modal -->
    <div class="modal" id="jsonModal">
        <h3>JSON View</h3>
        <div class="form-group">
            <div class="editor-wrapper">
                <textarea id="jsonViewer" readonly></textarea>
            </div>
        </div>
        <div class="modal-actions">
            <button class="secondary" onclick="closeAllModals()">Close</button>
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        const data = ${JSON.stringify({ columns: data.columns, rows })};
        const connectionId = '${connectionId}';
        const resource = '${resource}';
        const schema = ${schema ? `'${schema}'` : 'undefined'};
        let currentEditRow = null;
        let editors = {};

        // Initialize CodeMirror editors
        function initEditor(id, readOnly = false) {
            const element = document.getElementById(id);
            if (!element || editors[id]) return;

            editors[id] = CodeMirror.fromTextArea(element, {
                mode: 'application/json',
                theme: 'monokai',
                lineNumbers: true,
                lineWrapping: true,
                indentUnit: 2,
                smartIndent: true,
                readOnly: readOnly,
                extraKeys: {
                    'Ctrl-Enter': function(cm) {
                        if (id === 'queryEditor') executeMongoQuery();
                        else if (id === 'aggregateEditor') executeAggregation();
                    }
                }
            });
        }

        // Initialize all editors
        setTimeout(() => {
            initEditor('queryEditor');
            initEditor('aggregateEditor');
            initEditor('insertEditor');
            initEditor('editEditor');
            initEditor('viewEditor', true);
            initEditor('jsonViewer', true);
        }, 100);

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById('tab-' + tabName).classList.add('active');

                // Refresh CodeMirror editors when tab becomes visible
                Object.values(editors).forEach(ed => ed.refresh());
            });
        });

        // Message handler for receiving data from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showIndexes':
                    displayIndexes(message.indexes);
                    break;
                case 'showDocument':
                    displayDocument(message.document);
                    break;
            }
        });

        function refresh() {
            vscode.postMessage({ command: 'refresh', connectionId, resource, schema });
        }

        function showInsertDialog() {
            if (!editors['insertEditor']) initEditor('insertEditor');
            editors['insertEditor'].setValue('{\n  \n}');
            editors['insertEditor'].setCursor(1, 2);
            showModal('insertModal');
        }

        function insertDocument() {
            const doc = editors['insertEditor'].getValue();
            if (!doc.trim()) {
                alert('Please enter document JSON');
                return;
            }
            vscode.postMessage({ command: 'insertDocument', connectionId, resource, document: doc });
            closeAllModals();
        }

        function viewDocument(rowIdx) {
            const row = data.rows[rowIdx];
            const doc = {};
            data.columns.forEach((col, idx) => {
                let value = row[idx];
                // Try to parse JSON strings back to objects
                if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {}
                }
                doc[col] = value;
            });

            if (!editors['viewEditor']) initEditor('viewEditor', true);
            editors['viewEditor'].setValue(JSON.stringify(doc, null, 2));
            showModal('viewModal');
        }

        function editDocument(rowIdx) {
            currentEditRow = rowIdx;
            const row = data.rows[rowIdx];
            const doc = {};
            data.columns.forEach((col, idx) => {
                let value = row[idx];
                // Try to parse JSON strings back to objects
                if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {}
                }
                doc[col] = value;
            });

            if (!editors['editEditor']) initEditor('editEditor');
            editors['editEditor'].setValue(JSON.stringify(doc, null, 2));
            showModal('editModal');
        }

        function saveEdit() {
            const updatesStr = editors['editEditor'].getValue();
            let updates;
            try {
                updates = JSON.parse(updatesStr);
            } catch (e) {
                alert('Invalid JSON: ' + e.message);
                return;
            }

            vscode.postMessage({
                command: 'edit',
                connectionId,
                resource,
                schema,
                data: {
                    id: data.rows[currentEditRow][0],
                    updates
                }
            });
            closeAllModals();
        }

        function deleteRow(rowIdx) {
            if (!confirm('Are you sure you want to delete this document?')) {
                return;
            }

            vscode.postMessage({
                command: 'delete',
                connectionId,
                resource,
                schema,
                data: { id: data.rows[rowIdx][0] }
            });
        }

        function executeMongoQuery() {
            if (!editors['queryEditor']) return;
            const query = editors['queryEditor'].getValue().trim();
            if (!query) {
                alert('Please enter a MongoDB query');
                return;
            }
            vscode.postMessage({ command: 'executeQuery', connectionId, query, schema: resource });
        }

        function clearQuery() {
            if (editors['queryEditor']) {
                editors['queryEditor'].setValue('{\n  \n}');
                editors['queryEditor'].setCursor(1, 2);
            }
        }

        function executeAggregation() {
            if (!editors['aggregateEditor']) return;
            const pipeline = editors['aggregateEditor'].getValue().trim();
            if (!pipeline) {
                alert('Please enter an aggregation pipeline');
                return;
            }
            vscode.postMessage({ command: 'executeAggregate', connectionId, resource, pipeline });
        }

        function clearAggregate() {
            if (editors['aggregateEditor']) {
                editors['aggregateEditor'].setValue('[\\n  \\n]');
                editors['aggregateEditor'].setCursor(1, 2);
            }
        }

        function loadIndexes() {
            vscode.postMessage({ command: 'getIndexes', connectionId, resource });
        }

        function displayIndexes(indexes) {
            const list = document.getElementById('indexList');
            if (!indexes || indexes.length === 0) {
                list.innerHTML = '<li style="text-align: center; padding: 20px;">No indexes found</li>';
                return;
            }

            list.innerHTML = indexes.map(idx => {
                const keysStr = JSON.stringify(idx.key);
                const canDrop = idx.name !== '_id_';
                return \`
                    <li class="index-item">
                        <div>
                            <div class="index-name">\${idx.name}</div>
                            <div class="index-keys">\${keysStr}</div>
                        </div>
                        \${canDrop ? \`<button class="danger" onclick="dropIndex('\${idx.name}')">Drop</button>\` : '<span style="color: var(--vscode-descriptionForeground);">Default</span>'}
                    </li>
                \`;
            }).join('');
        }

        function showCreateIndexDialog() {
            document.getElementById('indexKeys').value = '';
            document.getElementById('indexOptions').value = '';
            showModal('createIndexModal');
        }

        function createIndex() {
            const keys = document.getElementById('indexKeys').value.trim();
            const options = document.getElementById('indexOptions').value.trim();

            if (!keys) {
                alert('Please enter index keys');
                return;
            }

            vscode.postMessage({ command: 'createIndex', connectionId, resource, keys, options });
            closeAllModals();
        }

        function dropIndex(indexName) {
            if (!confirm(\`Are you sure you want to drop the index "\${indexName}"?\`)) {
                return;
            }
            vscode.postMessage({ command: 'dropIndex', connectionId, resource, indexName });
        }

        function showJSON(rowIdx, cellIdx) {
            const cellValue = data.rows[rowIdx][cellIdx];
            try {
                const parsed = JSON.parse(cellValue);
                if (!editors['jsonViewer']) initEditor('jsonViewer', true);
                editors['jsonViewer'].setValue(JSON.stringify(parsed, null, 2));
                showModal('jsonModal');
            } catch (e) {
                alert('Invalid JSON');
            }
        }

        function applyQuickFilter() {
            const filterText = document.getElementById('quickFilter').value.toLowerCase();
            const rows = document.querySelectorAll('#dataTable tbody tr');
            let visibleCount = 0;

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(filterText)) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });

            document.getElementById('docCount').textContent = visibleCount;
        }

        function exportToJSON() {
            const docs = data.rows.map(row => {
                const doc = {};
                data.columns.forEach((col, idx) => {
                    let value = row[idx];
                    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                        try {
                            value = JSON.parse(value);
                        } catch (e) {}
                    }
                    doc[col] = value;
                });
                return doc;
            });

            const json = JSON.stringify(docs, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`\${resource}_export.json\`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function showModal(modalId) {
            document.getElementById('overlay').style.display = 'block';
            const modal = document.getElementById(modalId);
            modal.style.display = 'block';

            // Refresh editor when modal is shown
            setTimeout(() => {
                Object.values(editors).forEach(ed => ed.refresh());
            }, 10);
        }

        function closeAllModals() {
            document.getElementById('overlay').style.display = 'none';
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    </script>
</body>
</html>`;
}
