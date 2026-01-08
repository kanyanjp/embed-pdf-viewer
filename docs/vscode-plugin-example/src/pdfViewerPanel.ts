/**
 * PDF Viewer Panel Manager
 * 
 * Manages the WebView panel that displays the PDF viewer.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Manages the PDF viewer WebView panel
 */
export class PdfViewerPanel {
    /**
     * Track the currently active panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: PdfViewerPanel | undefined;

    private static readonly viewType = 'embedpdfViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    /**
     * Create or show the PDF viewer panel
     */
    public static createOrShow(extensionUri: vscode.Uri, pdfUri?: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (PdfViewerPanel.currentPanel) {
            PdfViewerPanel.currentPanel._panel.reveal(column);
            if (pdfUri) {
                PdfViewerPanel.currentPanel.loadPdf(pdfUri);
            }
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            PdfViewerPanel.viewType,
            'PDF Viewer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
                ]
            }
        );

        PdfViewerPanel.currentPanel = new PdfViewerPanel(panel, extensionUri, pdfUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, pdfUri?: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Load PDF if URI was provided
        if (pdfUri) {
            this.loadPdf(pdfUri);
        }

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'ready':
                        vscode.window.showInformationMessage('PDF viewer is ready');
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(`PDF Error: ${message.message}`);
                        break;
                    case 'pageChange':
                        // Update panel title with current page
                        this._panel.title = `PDF Viewer - Page ${message.pageNumber}`;
                        break;
                    case 'log':
                        console.log('[PDF Viewer]', message.message);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Load a PDF file into the viewer
     */
    public async loadPdf(uri: vscode.Uri) {
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            const base64 = Buffer.from(data).toString('base64');
            const filename = path.basename(uri.fsPath);

            this._panel.title = `PDF Viewer - ${filename}`;
            
            this._panel.webview.postMessage({
                type: 'loadPdf',
                data: base64,
                filename: filename
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load PDF: ${error}`);
        }
    }

    /**
     * Update the theme of the PDF viewer
     */
    public updateTheme(theme: 'light' | 'dark') {
        this._panel.webview.postMessage({
            type: 'updateTheme',
            theme: theme
        });
    }

    /**
     * Clean up resources
     */
    public dispose() {
        PdfViewerPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Update the webview content
     */
    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    /**
     * Generate HTML content for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get resource URIs
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'embedpdf.js')
        );

        // Generate nonce for CSP
        const nonce = getNonce();

        // Detect current theme
        const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark 
            ? 'dark' 
            : 'light';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}' 'wasm-unsafe-eval';
                   img-src ${webview.cspSource} data:;
                   font-src ${webview.cspSource};
                   worker-src blob:;
                   child-src blob:;">
    <title>PDF Viewer</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        #pdf-viewer {
            width: 100%;
            height: 100vh;
        }
        #loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div id="loading">Loading PDF viewer...</div>
    <div id="pdf-viewer" style="display: none;"></div>
    
    <script nonce="${nonce}">
        // Acquire VS Code API
        const vscode = acquireVsCodeApi();
        
        // Restore any previous state
        const previousState = vscode.getState();
        
        console.log('WebView initialized, previous state:', previousState);
    </script>
    
    <script nonce="${nonce}" type="module">
        import EmbedPDF from '${scriptUri}';
        
        const vscode = acquireVsCodeApi();
        let viewer = null;
        let currentPage = 1;
        
        // Initialize the PDF viewer with data
        function initViewer(pdfData) {
            const container = document.getElementById('pdf-viewer');
            const loading = document.getElementById('loading');
            
            try {
                // Convert base64 to Uint8Array
                const binary = atob(pdfData);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                
                // Initialize EmbedPDF
                viewer = EmbedPDF.init({
                    type: 'container',
                    target: container,
                    src: bytes,
                    theme: {
                        preference: '${theme}'
                    },
                    zoom: {
                        defaultLevel: 'fit-width',
                        minZoom: 0.5,
                        maxZoom: 5
                    },
                    scroll: {
                        strategy: 'vertical',
                        pageGap: 20
                    }
                });
                
                // Wait for registry to be ready
                viewer.registry.then(registry => {
                    // Hide loading, show viewer
                    loading.style.display = 'none';
                    container.style.display = 'block';
                    
                    // Get scroll plugin for page tracking
                    const ScrollPlugin = EmbedPDF.ScrollPlugin;
                    const scrollPlugin = registry.getPlugin(ScrollPlugin);
                    
                    // Listen for page changes
                    scrollPlugin.on('page-change', (event) => {
                        currentPage = event.pageNumber;
                        vscode.postMessage({
                            type: 'pageChange',
                            pageNumber: event.pageNumber
                        });
                        
                        // Save state
                        vscode.setState({ currentPage: event.pageNumber });
                    });
                    
                    // Restore previous page if available
                    const previousState = vscode.getState();
                    if (previousState && previousState.currentPage) {
                        scrollPlugin.scrollToPage(previousState.currentPage);
                    }
                    
                    vscode.postMessage({ type: 'ready' });
                }).catch(err => {
                    vscode.postMessage({ 
                        type: 'error', 
                        message: err.message 
                    });
                });
            } catch (error) {
                vscode.postMessage({
                    type: 'error',
                    message: error.message
                });
            }
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'loadPdf':
                    // Clear existing viewer if present
                    if (viewer) {
                        document.getElementById('pdf-viewer').innerHTML = '';
                        document.getElementById('loading').style.display = 'flex';
                        document.getElementById('pdf-viewer').style.display = 'none';
                    }
                    initViewer(message.data);
                    break;
                    
                case 'updateTheme':
                    if (viewer) {
                        viewer.setTheme(message.theme);
                    }
                    break;
            }
        });
        
        // Notify extension that webview is ready
        vscode.postMessage({ type: 'webviewReady' });
    </script>
</body>
</html>`;
    }
}

/**
 * Generate a random nonce for CSP
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
