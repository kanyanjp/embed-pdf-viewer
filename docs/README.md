# EmbedPDF UI Analysis and VSCode Plugin Integration Guide

## Overview

This document provides a comprehensive analysis of how the EmbedPDF UI components are used and demonstrates how to integrate EmbedPDF as a VSCode plugin.

For the detailed Chinese version, see [VSCODE_PLUGIN_INTEGRATION_ZH.md](./VSCODE_PLUGIN_INTEGRATION_ZH.md).

## Quick Summary

### UI Usage Methods

EmbedPDF supports three primary integration approaches:

1. **Snippet Method** (Easiest)
   - Drop-in solution using CDN
   - No build tools required
   - Complete UI out-of-the-box
   
   ```html
   <script type="module">
     import EmbedPDF from 'https://cdn.jsdelivr.net/npm/@embedpdf/snippet@2/dist/embedpdf.js';
     
     const viewer = EmbedPDF.init({
       type: 'container',
       target: document.getElementById('pdf-viewer'),
       src: '/document.pdf'
     });
   </script>
   ```

2. **Framework Components** (React, Vue, Svelte)
   - Framework-specific wrapper components
   - Integrates with existing React/Vue/Svelte apps
   
   ```tsx
   import { PDFViewer } from '@embedpdf/react-pdf-viewer';
   
   function App() {
     return (
       <PDFViewer
         config={{ src: '/document.pdf' }}
         style={{ width: '100%', height: '100vh' }}
       />
     );
   }
   ```

3. **Core API** (Full Control)
   - Direct access to plugin architecture
   - Maximum customization
   - Ideal for VSCode plugin integration

### VSCode Plugin Integration

The key steps to integrate EmbedPDF into a VSCode plugin:

1. **Use WebView API** - Create an isolated browser environment
2. **Message Passing** - Communicate between extension and WebView using `postMessage`
3. **Data Transfer** - Convert PDF files to `Uint8Array` or Base64
4. **CSP Configuration** - Allow WASM execution with proper Content Security Policy
5. **Theme Integration** - Sync with VSCode's theme system

### Architecture

```
embed-pdf-viewer/
├── packages/              # Core packages and plugins
│   ├── core/             # Framework-agnostic core
│   ├── engines/          # PDF rendering (PDFium)
│   ├── plugin-ui/        # UI components
│   └── plugin-*/         # Feature plugins
├── viewers/              # Framework wrappers
│   ├── react/
│   ├── vue/
│   ├── svelte/
│   └── snippet/          # Standalone viewer
└── examples/             # Example applications
```

### Example Code

Complete working examples are provided in [`vscode-plugin-example/`](./vscode-plugin-example/):

- `src/extension.ts` - Extension entry point
- `src/pdfViewerPanel.ts` - WebView panel manager
- `src/pdfEditorProvider.ts` - Custom editor provider

### Key Features

- ✅ Complete PDF viewing (zoom, search, annotations)
- ✅ Modern UI with toolbar, sidebar, thumbnails
- ✅ Plugin-based architecture
- ✅ Framework agnostic core
- ✅ MIT licensed
- ✅ Active development

### Integration Benefits

1. **For Quick Integration**: Use the Snippet method
2. **For React/Vue/Svelte Apps**: Use framework components
3. **For VSCode Plugin**: Use Core API with WebView

## Next Steps

1. Review the detailed Chinese documentation: [VSCODE_PLUGIN_INTEGRATION_ZH.md](./VSCODE_PLUGIN_INTEGRATION_ZH.md)
2. Explore the example code: [vscode-plugin-example/](./vscode-plugin-example/)
3. Check the official documentation: https://www.embedpdf.com/docs

## Resources

- **Main Repository**: https://github.com/embedpdf/embed-pdf-viewer
- **Documentation**: https://www.embedpdf.com
- **Live Demo**: https://app.embedpdf.com
- **Discord Community**: https://discord.gg/mHHABmmuVU
