// Global variables
const vscode = acquireVsCodeApi();
let data = { columns: [], rows: [] };
let connectionId = '';
let connectionName = '';
let resource = '';
let schema = '';
let currentEditRow = null;
let editors = {};

// Visual Query Builder variables
let filters = [];
let filterIdCounter = 0;

const comparisonOperators = [
    { value: '$eq', label: '= (equals)' },
    { value: '$ne', label: '!= (not equals)' },
    { value: '$gt', label: '> (greater than)' },
    { value: '$gte', label: '>= (greater than or equal)' },
    { value: '$lt', label: '< (less than)' },
    { value: '$lte', label: '<= (less than or equal)' },
    { value: '$in', label: 'IN (in array)' },
    { value: '$nin', label: 'NOT IN (not in array)' },
    { value: '$regex', label: 'REGEX (pattern match)' },
    { value: '$exists', label: 'EXISTS (field exists)' }
];

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

// Initialize data and render the view
function initializeView(initData) {
    data = initData.data;
    connectionId = initData.connectionId;
    connectionName = initData.connectionName || connectionId;
    resource = initData.resource;
    schema = initData.schema || '';

    // Hide loading message and show content
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';

    // Update header with connection name and resource
    document.getElementById('headerTitle').textContent = connectionName + ' > ' + resource;
    document.getElementById('docCount').textContent = data.rows.length;
    document.getElementById('fieldCount').textContent = data.columns.length;

    // Render the data table
    renderDataTable();

    // Update field selection and sort options for Visual Query Builder
    updateFieldSelectionGrid();
    updateSortFieldOptions();

    // Initialize CodeMirror editors
    setTimeout(() => {
        initEditor('queryEditor');
        initEditor('aggregateEditor');
        initEditor('insertEditor');
        initEditor('editEditor');
        initEditor('viewEditor', true);
        initEditor('jsonViewer', true);
    }, 100);
}

// Render the data table
function renderDataTable() {
    const thead = document.getElementById('dataTableHead');
    const tbody = document.getElementById('dataTableBody');

    // Clear existing content
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Create header row
    const headerRow = document.createElement('tr');
    data.columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    const actionsHeader = document.createElement('th');
    actionsHeader.style.width = '140px';
    actionsHeader.textContent = 'Actions';
    headerRow.appendChild(actionsHeader);
    thead.appendChild(headerRow);

    // Create data rows
    data.rows.forEach((row, rowIdx) => {
        const tr = document.createElement('tr');
        tr.dataset.rowId = rowIdx;

        row.forEach((cell, cellIdx) => {
            const td = document.createElement('td');
            const cellStr = typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
            const isJSON = cellStr.startsWith('{') || cellStr.startsWith('[');

            if (isJSON) {
                td.className = 'expandable';
                td.onclick = () => showJSON(rowIdx, cellIdx);
            }

            td.title = cellStr;
            td.textContent = cellStr;
            tr.appendChild(td);
        });

        // Add actions column
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `
            <div class="action-buttons">
                <button onclick="viewDocument(${rowIdx})">👁️</button>
                <button onclick="editDocument(${rowIdx})">✏️</button>
                <button class="danger" onclick="deleteRow(${rowIdx})">🗑️</button>
            </div>
        `;
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });
}

// Update field selection grid for Visual Query Builder
function updateFieldSelectionGrid() {
    const grid = document.getElementById('fieldSelectionGrid');
    if (!grid) return;

    grid.innerHTML = data.columns.map(col => `
        <label class="field-checkbox">
            <input type="checkbox" value="${col}" onchange="updateFieldSelection()">
            <span>${col}</span>
        </label>
    `).join('');
}

// Update sort field options
function updateSortFieldOptions() {
    const sortField = document.getElementById('sortField');
    if (!sortField) return;

    sortField.innerHTML = '<option value="">No sorting</option>' +
        data.columns.map(col => `<option value="${col}">${col}</option>`).join('');
}

// Tab switching
document.addEventListener('DOMContentLoaded', () => {
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
});

// Message handler for receiving data from extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'init':
            initializeView(message);
            break;
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
        editors['aggregateEditor'].setValue('[\n  \n]');
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
        const dropButton = canDrop ? `<button class="danger" onclick="dropIndex('${idx.name}')">Drop</button>` : '<span style="color: var(--vscode-descriptionForeground);">Default</span>';
        return `<li class="index-item">
            <div>
                <div class="index-name">${idx.name}</div>
                <div class="index-keys">${keysStr}</div>
            </div>
            ${dropButton}
        </li>`;
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
    if (!confirm(`Are you sure you want to drop the index "${indexName}"?`)) {
        return;
    }
    vscode.postMessage({ command: 'dropIndex', connectionId, resource, indexName });
}

function showJSON(rowIdx, cellIdx) {
    const cellValue = data.rows[rowIdx][cellIdx];
    const cellStr = typeof cellValue === 'object' ? JSON.stringify(cellValue) : String(cellValue);
    try {
        const parsed = JSON.parse(cellStr);
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
    a.download = resource + '_export.json';
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

// ==== Visual Query Builder Functions ====

function goToWizardStep(stepNumber) {
    // Update step indicator
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum === stepNumber) {
            step.classList.add('active');
        } else if (stepNum < stepNumber) {
            step.classList.add('completed');
        }
    });

    // Update step content
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById('wizard-step-' + stepNumber).classList.add('active');

    // Update final query preview if on step 3
    if (stepNumber === 3) {
        updateFinalPreview();
    }
}

function selectAllFields() {
    const checkboxes = document.querySelectorAll('#fieldSelectionGrid input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    updateFieldSelection();
}

function deselectAllFields() {
    const checkboxes = document.querySelectorAll('#fieldSelectionGrid input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateFieldSelection();
}

function updateFieldSelection() {
    const checkboxes = document.querySelectorAll('#fieldSelectionGrid input[type="checkbox"]:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);
    const preview = document.getElementById('selectedFieldsPreview');

    if (selected.length === 0) {
        preview.textContent = 'None (all fields will be returned)';
    } else {
        preview.textContent = selected.join(', ');
    }
}

function addFilter() {
    const filterId = filterIdCounter++;
    const fieldOptions = data.columns.map(col => `<option value="${col}">${col}</option>`).join('');
    const operatorOptions = comparisonOperators.map(op => `<option value="${op.value}">${op.label}</option>`).join('');

    // Remove empty state message if it exists
    const emptyState = document.querySelector('#filterBuilder .empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const filterHtml = `
        <div class="filter-row" data-filter-id="${filterId}">
            <div>
                <label>Field</label>
                <select id="filter-field-${filterId}" onchange="updateQueryPreview()">
                    <option value="">Select field...</option>
                    ${fieldOptions}
                </select>
            </div>
            <div>
                <label>Operator</label>
                <select id="filter-operator-${filterId}" onchange="updateQueryPreview()">
                    ${operatorOptions}
                </select>
            </div>
            <div>
                <label>Value</label>
                <input type="text" id="filter-value-${filterId}" placeholder="Enter value..." onchange="updateQueryPreview()">
            </div>
            <div>
                <label>Type</label>
                <select id="filter-type-${filterId}" onchange="updateQueryPreview()">
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                </select>
            </div>
            <div>
                <button class="danger" onclick="removeFilter(${filterId})" title="Remove filter">✕</button>
            </div>
        </div>
    `;

    document.getElementById('filterBuilder').insertAdjacentHTML('beforeend', filterHtml);
    filters.push(filterId);
    updateQueryPreview();
}

function removeFilter(filterId) {
    const filterRow = document.querySelector(`[data-filter-id="${filterId}"]`);
    if (filterRow) {
        filterRow.remove();
        filters = filters.filter(id => id !== filterId);
        updateQueryPreview();

        // Show empty state if no filters remain
        if (filters.length === 0) {
            document.getElementById('filterBuilder').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No filters added yet</p>
                    <p style="font-size: 12px;">Click "Add Filter" to start building your query</p>
                </div>
            `;
        }
    }
}

function clearFilters() {
    document.getElementById('filterBuilder').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <p>No filters added yet</p>
            <p style="font-size: 12px;">Click "Add Filter" to start building your query</p>
        </div>
    `;
    filters = [];
    updateQueryPreview();
}

function buildQueryFromFilters() {
    if (filters.length === 0) {
        return {};
    }

    const conditions = [];

    filters.forEach(filterId => {
        const field = document.getElementById(`filter-field-${filterId}`)?.value;
        const operator = document.getElementById(`filter-operator-${filterId}`)?.value;
        const value = document.getElementById(`filter-value-${filterId}`)?.value;
        const type = document.getElementById(`filter-type-${filterId}`)?.value;

        if (!field || !value) return;

        let parsedValue = value;

        // Parse value based on type
        try {
            if (type === 'number') {
                parsedValue = parseFloat(value);
            } else if (type === 'boolean') {
                parsedValue = value.toLowerCase() === 'true';
            } else if (type === 'array') {
                parsedValue = JSON.parse(value);
            }
        } catch (e) {
            // Keep as string if parsing fails
        }

        // Build condition based on operator
        if (operator === '$eq') {
            conditions.push({ [field]: parsedValue });
        } else if (operator === '$exists') {
            conditions.push({ [field]: { $exists: parsedValue === true || parsedValue === 'true' } });
        } else {
            conditions.push({ [field]: { [operator]: parsedValue } });
        }
    });

    if (conditions.length === 0) {
        return {};
    }

    if (conditions.length === 1) {
        return conditions[0];
    }

    const logicOp = document.getElementById('logicOperator')?.value || '$and';
    return { [logicOp]: conditions };
}

function updateQueryPreview() {
    const query = buildQueryFromFilters();
    document.getElementById('queryPreview').textContent = JSON.stringify(query, null, 2);
}

function updateFinalPreview() {
    // Filter preview
    const filterQuery = buildQueryFromFilters();
    document.getElementById('finalFilterPreview').textContent = JSON.stringify(filterQuery, null, 2);

    // Projection preview
    const checkboxes = document.querySelectorAll('#fieldSelectionGrid input[type="checkbox"]:checked');
    const selectedFields = Array.from(checkboxes).map(cb => cb.value);

    if (selectedFields.length === 0) {
        document.getElementById('finalProjectionPreview').textContent = 'All fields';
    } else {
        const projection = {};
        selectedFields.forEach(field => projection[field] = 1);
        document.getElementById('finalProjectionPreview').textContent = JSON.stringify(projection, null, 2);
    }

    // Sort preview
    const sortField = document.getElementById('sortField')?.value;
    const sortOrder = document.getElementById('sortOrder')?.value;

    if (sortField) {
        const sort = { [sortField]: parseInt(sortOrder) };
        document.getElementById('finalSortPreview').textContent = JSON.stringify(sort, null, 2);
    } else {
        document.getElementById('finalSortPreview').textContent = 'None';
    }

    // Limit preview
    const limit = document.getElementById('limitResults')?.value;
    document.getElementById('finalLimitPreview').textContent = limit || '100';
}

function executeVisualQuery() {
    // Build the complete query
    const filter = buildQueryFromFilters();

    // Get projection
    const checkboxes = document.querySelectorAll('#fieldSelectionGrid input[type="checkbox"]:checked');
    const selectedFields = Array.from(checkboxes).map(cb => cb.value);
    const projection = selectedFields.length > 0 ? selectedFields.reduce((acc, field) => {
        acc[field] = 1;
        return acc;
    }, {}) : null;

    // Get sort
    const sortField = document.getElementById('sortField')?.value;
    const sortOrder = document.getElementById('sortOrder')?.value;
    const sort = sortField ? { [sortField]: parseInt(sortOrder) } : null;

    // Get limit and skip
    const limit = parseInt(document.getElementById('limitResults')?.value || '100');
    const skip = parseInt(document.getElementById('skipResults')?.value || '0');

    // Build the aggregation pipeline that mimics find with projection, sort, limit, skip
    const pipeline = [];

    // Add match stage if there are filters
    if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
    }

    // Add sort stage if specified
    if (sort) {
        pipeline.push({ $sort: sort });
    }

    // Add skip stage if specified
    if (skip > 0) {
        pipeline.push({ $skip: skip });
    }

    // Add limit stage
    pipeline.push({ $limit: limit });

    // Add project stage if specified
    if (projection) {
        pipeline.push({ $project: projection });
    }

    // Execute the aggregation
    const pipelineStr = JSON.stringify(pipeline);
    vscode.postMessage({ command: 'executeAggregate', connectionId, resource, pipeline: pipelineStr });
}

function resetWizard() {
    // Reset field selection
    deselectAllFields();

    // Reset filters
    clearFilters();

    // Reset options
    document.getElementById('sortField').value = '';
    document.getElementById('limitResults').value = '100';
    document.getElementById('skipResults').value = '0';
    document.getElementById('logicOperator').value = '$and';

    // Go to step 1
    goToWizardStep(1);
}