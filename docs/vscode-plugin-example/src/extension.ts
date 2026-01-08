/**
 * VSCode Extension Entry Point
 * 
 * This file initializes the PDF viewer extension and registers commands and providers.
 */

import * as vscode from 'vscode';
import { PdfViewerPanel } from './pdfViewerPanel';
import { PdfEditorProvider } from './pdfEditorProvider';

/**
 * Activates the extension
 * @param context - Extension context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('EmbedPDF extension is now active');

    // Register command to open PDF files
    const openPdfCommand = vscode.commands.registerCommand(
        'embedpdf.openPdf',
        (uri?: vscode.Uri) => {
            // If no URI provided, ask user to select a file
            if (!uri) {
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    filters: {
                        'PDF Files': ['pdf']
                    }
                }).then(uris => {
                    if (uris && uris.length > 0) {
                        PdfViewerPanel.createOrShow(context.extensionUri, uris[0]);
                    }
                });
            } else {
                PdfViewerPanel.createOrShow(context.extensionUri, uri);
            }
        }
    );

    // Register custom editor provider for PDF files
    const pdfEditorProvider = new PdfEditorProvider(context);
    const customEditorRegistration = vscode.window.registerCustomEditorProvider(
        'embedpdf.pdfEditor',
        pdfEditorProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    // Listen for theme changes and notify open viewers
    const themeChangeListener = vscode.window.onDidChangeActiveColorTheme((theme) => {
        const themeKind = theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
        
        // Notify the active PDF viewer panel
        if (PdfViewerPanel.currentPanel) {
            PdfViewerPanel.currentPanel.updateTheme(themeKind);
        }
    });

    // Add subscriptions to context
    context.subscriptions.push(
        openPdfCommand,
        customEditorRegistration,
        themeChangeListener
    );
}

/**
 * Deactivates the extension
 */
export function deactivate() {
    console.log('EmbedPDF extension is now deactivated');
}
