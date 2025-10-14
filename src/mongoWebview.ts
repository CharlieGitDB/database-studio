import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { QueryResult } from './types';

export function getMongoDBWebviewContent(
    extensionUri: vscode.Uri,
    webview: vscode.Webview,
    data: QueryResult,
    connectionId: string,
    resource: string,
    schema?: string
): string {
    // Convert data rows to ensure proper formatting
    const formattedRows = data.rows.map(row => {
        return data.columns.map((col, idx) => {
            const value = row[idx];
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        });
    });

    // Read the HTML and JS files
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'webviews', 'mongoDbView.html');
    const jsPath = path.join(extensionUri.fsPath, 'src', 'webviews', 'mongoDbView.js');

    let html = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // Create CSP that allows inline scripts and event handlers
    // Note: 'unsafe-inline' is needed for inline event handlers (onclick, onchange, etc.)
    // We're in a webview context which is already sandboxed by VSCode
    const csp = `default-src 'none'; style-src https://cdnjs.cloudflare.com 'unsafe-inline'; script-src https://cdnjs.cloudflare.com 'unsafe-inline'; font-src https://cdnjs.cloudflare.com;`;

    // Replace CSP
    html = html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

    // Replace script placeholder with inline script
    html = html.replace(
        '<script src="__SCRIPT_URI__"></script>',
        `<script>${jsContent}</script>`
    );

    // Send initialization data after the webview loads
    setTimeout(() => {
        webview.postMessage({
            command: 'init',
            data: {
                columns: data.columns,
                rows: formattedRows
            },
            connectionId,
            resource,
            schema
        });
    }, 100);

    return html;
}