export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
}

export class ThemeIcon {
    constructor(public readonly id: string) {}
}

export class TreeItem {
    label: string;
    collapsibleState: TreeItemCollapsibleState;
    iconPath?: ThemeIcon;
    contextValue?: string;

    constructor(label: string, collapsibleState: TreeItemCollapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export class EventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];

    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
    };

    fire(data: T): void {
        this.listeners.forEach(l => l(data));
    }

    dispose(): void {
        this.listeners = [];
    }
}

export class Uri {
    static file(path: string): Uri {
        return new Uri(path);
    }

    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        return new Uri([base.fsPath, ...pathSegments].join('/'));
    }

    constructor(public readonly fsPath: string) {}

    toString(): string {
        return this.fsPath;
    }
}

export const window = {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    createTreeView: jest.fn().mockReturnValue({
        onDidExpandElement: jest.fn(),
        dispose: jest.fn(),
    }),
    createWebviewPanel: jest.fn().mockReturnValue({
        webview: {
            html: '',
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn(),
            asWebviewUri: jest.fn((uri: Uri) => uri),
            cspSource: 'mock-csp',
        },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn(),
    }),
};

export const commands = {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
};

export enum ViewColumn {
    One = 1,
    Two = 2,
    Three = 3,
}

export const workspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn(),
        update: jest.fn(),
    }),
};

export class ExtensionContext {
    subscriptions: { dispose: () => void }[] = [];
    globalState = {
        get: jest.fn().mockReturnValue([]),
        update: jest.fn().mockResolvedValue(undefined),
    };
    extensionUri = Uri.file('/mock/extension');
    extensionPath = '/mock/extension';
}
