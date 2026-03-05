(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // Elements
    const formTitle = document.getElementById('formTitle');
    const connName = document.getElementById('connName');
    const connType = document.getElementById('connType');
    const connHost = document.getElementById('connHost');
    const connPort = document.getElementById('connPort');
    const connUsername = document.getElementById('connUsername');
    const connPassword = document.getElementById('connPassword');
    const connDatabase = document.getElementById('connDatabase');
    const connUpdateProtection = document.getElementById('connUpdateProtection');
    const usernameGroup = document.getElementById('usernameGroup');
    const databaseGroup = document.getElementById('databaseGroup');
    const databaseLabel = document.getElementById('databaseLabel');
    const optionsSection = document.getElementById('optionsSection');
    const updateProtectionGroup = document.getElementById('updateProtectionGroup');
    const passwordHint = document.getElementById('passwordHint');
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const statusMessage = document.getElementById('statusMessage');

    const defaultPorts = {
        redis: 6379,
        mysql: 3306,
        postgresql: 5432,
        mongodb: 27017
    };

    let mode = 'add';
    let editId = null;
    let existingPassword = null;
    let portManuallyChanged = false;

    // Track manual port changes
    connPort.addEventListener('input', function () {
        portManuallyChanged = true;
    });

    // Type change handler — toggle field visibility & update default port
    connType.addEventListener('change', function () {
        const type = connType.value;
        updateFieldVisibility(type);

        // Update port to default for selected type (unless user manually edited)
        if (!portManuallyChanged && type && defaultPorts[type]) {
            connPort.value = defaultPorts[type];
        }
    });

    function updateFieldVisibility(type) {
        if (!type) {
            // No type selected — hide conditional sections
            usernameGroup.classList.add('hidden');
            databaseGroup.classList.add('hidden');
            optionsSection.classList.add('hidden');
            return;
        }

        if (type === 'redis') {
            usernameGroup.classList.add('hidden');
            databaseGroup.classList.add('hidden');
            optionsSection.classList.add('hidden');
        } else {
            usernameGroup.classList.remove('hidden');

            if (type === 'mysql' || type === 'postgresql' || type === 'mongodb') {
                databaseGroup.classList.remove('hidden');
            } else {
                databaseGroup.classList.add('hidden');
            }

            if (type === 'mysql' || type === 'postgresql') {
                optionsSection.classList.remove('hidden');
            } else {
                optionsSection.classList.add('hidden');
            }
        }

        // Update database label
        if (type === 'postgresql') {
            databaseLabel.innerHTML = 'Database <span class="required">*</span>';
        } else {
            databaseLabel.textContent = 'Database';
        }
    }

    // Save handler
    saveBtn.addEventListener('click', function () {
        clearStatus();
        clearValidation();

        const data = getFormData();
        if (!validate(data)) {
            return;
        }

        vscode.postMessage({ command: 'save', data: data });
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    });

    // Test connection handler
    testBtn.addEventListener('click', function () {
        clearStatus();
        clearValidation();

        const data = getFormData();
        if (!validate(data)) {
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        showStatus('testing', 'Testing connection...');

        vscode.postMessage({ command: 'testConnection', data: data });
    });

    // Cancel handler
    cancelBtn.addEventListener('click', function () {
        vscode.postMessage({ command: 'cancel' });
    });

    function getFormData() {
        const type = connType.value;
        const data = {
            name: connName.value.trim(),
            type: type,
            host: connHost.value.trim(),
            port: parseInt(connPort.value) || 0
        };

        if (type !== 'redis') {
            data.username = connUsername.value.trim() || undefined;
            data.database = connDatabase.value.trim() || undefined;
        }

        // Password handling
        const passwordValue = connPassword.value;
        if (mode === 'edit') {
            // In edit mode: empty password keeps existing, non-empty replaces
            data.password = passwordValue || existingPassword || undefined;
        } else {
            data.password = passwordValue || undefined;
        }

        if (type === 'mysql' || type === 'postgresql') {
            data.updateProtection = connUpdateProtection.checked;
        }

        if (mode === 'edit' && editId) {
            data.id = editId;
        }

        return data;
    }

    function validate(data) {
        let valid = true;

        if (!data.name) {
            markInvalid(connName);
            valid = false;
        }
        if (!data.type) {
            markInvalid(connType);
            valid = false;
        }
        if (!data.host) {
            markInvalid(connHost);
            valid = false;
        }
        if (!data.port || data.port <= 0 || data.port > 65535) {
            markInvalid(connPort);
            valid = false;
        }
        if (data.type === 'postgresql' && !data.database) {
            markInvalid(connDatabase);
            valid = false;
        }

        if (!valid) {
            showStatus('error', 'Please fill in all required fields.');
        }

        return valid;
    }

    function markInvalid(el) {
        el.classList.add('validation-error');
        el.addEventListener('input', function handler() {
            el.classList.remove('validation-error');
            el.removeEventListener('input', handler);
        });
        el.addEventListener('change', function handler() {
            el.classList.remove('validation-error');
            el.removeEventListener('change', handler);
        });
    }

    function clearValidation() {
        document.querySelectorAll('.validation-error').forEach(function (el) {
            el.classList.remove('validation-error');
        });
    }

    function showStatus(type, message) {
        statusMessage.className = 'status-message ' + type;
        statusMessage.textContent = message;
    }

    function clearStatus() {
        statusMessage.className = 'status-message';
        statusMessage.textContent = '';
    }

    // Listen for messages from the extension
    window.addEventListener('message', function (event) {
        const msg = event.data;

        switch (msg.command) {
            case 'init':
                mode = msg.mode || 'add';
                if (mode === 'edit' && msg.config) {
                    editId = msg.config.id;
                    existingPassword = msg.config.password || null;
                    formTitle.textContent = 'Edit Connection';
                    saveBtn.textContent = 'Save Changes';

                    connName.value = msg.config.name || '';
                    connType.value = msg.config.type || '';
                    connType.disabled = true; // Type locked on edit
                    connHost.value = msg.config.host || 'localhost';
                    connPort.value = msg.config.port || '';
                    connUsername.value = msg.config.username || '';
                    connDatabase.value = msg.config.database || '';
                    connUpdateProtection.checked = !!msg.config.updateProtection;

                    if (existingPassword) {
                        passwordHint.textContent = 'Leave empty to keep existing password';
                    }

                    portManuallyChanged = true; // Don't overwrite port on type init
                    updateFieldVisibility(msg.config.type);
                } else {
                    formTitle.textContent = 'Add Connection';
                    saveBtn.textContent = 'Save Connection';
                    updateFieldVisibility('');
                }
                break;

            case 'testResult':
                testBtn.disabled = false;
                testBtn.textContent = 'Test Connection';
                if (msg.success) {
                    showStatus('success', 'Connection successful!');
                } else {
                    showStatus('error', 'Connection failed: ' + (msg.error || 'Unknown error'));
                }
                break;

            case 'saveResult':
                saveBtn.disabled = false;
                if (mode === 'edit') {
                    saveBtn.textContent = 'Save Changes';
                } else {
                    saveBtn.textContent = 'Save Connection';
                }
                if (!msg.success) {
                    showStatus('error', 'Failed to save: ' + (msg.error || 'Unknown error'));
                }
                break;
        }
    });
})();
