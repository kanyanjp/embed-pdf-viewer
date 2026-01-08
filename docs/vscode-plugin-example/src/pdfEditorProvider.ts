/**
 * PDF Custom Editor Provider
 * 
 * Allows PDF files to be opened with the EmbedPDF viewer as the default editor.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Custom editor provider for PDF files
 */
export class PdfEditorProvider implements vscode.CustomReadonlyEditorProvider<PdfDocument> {
    private static readonly viewType = 'embedpdf.pdfEditor';

    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Called when a PDF document is opened
     */
    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<PdfDocument> {
        return new PdfDocument(uri);
    }

    /**
     * Called when the editor is being shown
     */
    async resolveCustomEditor(
        document: PdfDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Configure webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
            ]
        };

        // Set HTML content
        webviewPanel.webview.html = this.getHtmlForWebview(
            webviewPanel.webview,
            document.uri
        );

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'ready':
                    // Load the PDF once viewer is ready
                    this.loadPdfIntoWebview(webviewPanel.webview, document.uri);
                    break;
                case 'error':
                    vscode.window.showErrorMessage(`PDF Error: ${message.message}`);
                    break;
            }
        });

        // Listen for theme changes
        const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme((theme) => {
            const themeKind = theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
            webviewPanel.webview.postMessage({
                type: 'updateTheme',
                theme: themeKind
            });
        });

        // Clean up when editor is closed
        webviewPanel.onDidDispose(() => {
            themeChangeDisposable.dispose();
        });
    }

    /**
     * Load PDF data into the webview
     */
    private async loadPdfIntoWebview(webview: vscode.Webview, uri: vscode.Uri) {
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            const base64 = Buffer.from(data).toString('base64');
            const filename = path.basename(uri.fsPath);

            webview.postMessage({
                type: 'loadPdf',
                data: base64,
                filename: filename
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load PDF: ${error}`);
        }
    }

    /**
     * Generate HTML for the webview
     */
    private getHtmlForWebview(webview: vscode.Webview, pdfUri: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'embedpdf.js')
        );

        const nonce = getNonce();
        const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark 
            ? 'dark' 
            : 'light';
        const filename = path.basename(pdfUri.fsPath);

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
    <title>${filename}</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
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
    <div id="loading">Loading ${filename}...</div>
    <div id="pdf-viewer" style="display: none;"></div>
    
    <script nonce="${nonce}" type="module">
        import EmbedPDF from '${scriptUri}';
        
        const vscode = acquireVsCodeApi();
        let viewer = null;
        
        function initViewer(pdfData) {
            const container = document.getElementById('pdf-viewer');
            const loading = document.getElementById('loading');
            
            try {
                const binary = atob(pdfData);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                
                viewer = EmbedPDF.init({
                    type: 'container',
                    target: container,
                    src: bytes,
                    theme: { preference: '${theme}' },
                    zoom: { defaultLevel: 'fit-width' }
                });
                
                viewer.registry.then(() => {
                    loading.style.display = 'none';
                    container.style.display = 'block';
                    vscode.postMessage({ type: 'ready' });
                }).catch(err => {
                    vscode.postMessage({ type: 'error', message: err.message });
                });
            } catch (error) {
                vscode.postMessage({ type: 'error', message: error.message });
            }
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'loadPdf':
                    initViewer(message.data);
                    break;
                case 'updateTheme':
                    if (viewer) {
                        viewer.setTheme(message.theme);
                    }
                    break;
            }
        });
        
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}

/**
 * Represents a PDF document
 */
class PdfDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}

    dispose(): void {
        // Clean up document resources if needed
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
