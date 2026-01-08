# EmbedPDF UI 使用分析及 VSCode 插件集成方案

## 项目概述

EmbedPDF 是一个开源的 JavaScript PDF 查看器，采用 MIT 许可证，支持多种前端框架（React、Vue、Svelte、Preact）及原生 JavaScript。项目采用插件化架构，具有良好的可扩展性。

## 一、项目架构分析

### 1.1 核心架构组件

```
embed-pdf-viewer/
├── packages/              # 核心包和插件
│   ├── core/             # 核心 PDF 引擎和框架适配器
│   ├── engines/          # PDF 渲染引擎（PDFium）
│   ├── models/           # 数据模型和类型定义
│   ├── pdfium/           # PDFium WASM 绑定
│   ├── plugin-ui/        # UI 插件（工具栏、侧边栏、菜单等）
│   ├── plugin-annotation/# 注释功能插件
│   ├── plugin-search/    # 搜索功能插件
│   ├── plugin-zoom/      # 缩放功能插件
│   └── plugin-*/         # 其他功能插件
├── viewers/              # 框架特定的查看器组件
│   ├── react/           # React 封装组件
│   ├── vue/             # Vue 封装组件
│   ├── svelte/          # Svelte 封装组件
│   └── snippet/         # 独立的即用型查看器
└── examples/             # 各框架的示例应用
    ├── react-mui/
    ├── vue-vuetify/
    └── svelte-tailwind/
```

### 1.2 核心设计模式

**插件化架构**：
- 核心功能通过插件系统实现模块化
- 每个插件独立负责特定功能（如缩放、注释、搜索等）
- 插件之间通过事件系统和共享状态通信

**框架适配器模式**：
- `@embedpdf/core` 提供框架无关的核心逻辑
- 为 React、Vue、Svelte 等框架提供专门的适配器
- 支持多框架共享同一套核心代码

## 二、UI 部分使用方式

### 2.1 Snippet 方式（最简单）

这是最快捷的使用方式，适合快速集成：

```html
<!DOCTYPE html>
<html>
<head>
    <title>PDF Viewer</title>
</head>
<body>
    <div id="pdf-viewer" style="height: 100vh"></div>
    <script type="module">
        import EmbedPDF from 'https://cdn.jsdelivr.net/npm/@embedpdf/snippet@2/dist/embedpdf.js';
        
        const viewer = EmbedPDF.init({
            type: 'container',
            target: document.getElementById('pdf-viewer'),
            src: '/document.pdf',
            
            // 主题配置
            theme: { preference: 'system' },
            
            // 功能配置
            zoom: { defaultLevel: 'fit-width', minZoom: 0.5, maxZoom: 5 },
            scroll: { strategy: 'vertical', pageGap: 20 },
            annotations: { autoCommit: false, author: 'John Doe' },
        });
        
        // 访问插件注册表
        viewer.registry.then(registry => {
            // 获取特定插件
            const zoomPlugin = registry.getPlugin(ZoomPlugin);
            // 调用插件方法
        });
    </script>
</body>
</html>
```

**核心 API**：
- `EmbedPDF.init(config)`: 初始化查看器
- `viewer.registry`: 获取插件注册表（Promise）
- `viewer.setTheme(theme)`: 运行时更改主题
- `viewer.addEventListener('themechange', callback)`: 监听主题变化

### 2.2 React 组件方式

```tsx
import { PDFViewer } from '@embedpdf/react-pdf-viewer';

function App() {
    return (
        <PDFViewer
            config={{
                src: '/document.pdf',
                theme: { preference: 'system' },
                zoom: { defaultLevel: 'fit-width' },
            }}
            style={{ width: '100%', height: '100vh' }}
            onReady={(registry) => {
                console.log('PDF viewer ready', registry);
            }}
        />
    );
}
```

### 2.3 自定义集成方式（完全控制）

对于需要深度定制的场景（如 VSCode 插件），可以直接使用核心 API：

```typescript
import { createPluginRegistration } from '@embedpdf/core';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport/react';
import { ScrollPluginPackage } from '@embedpdf/plugin-scroll/react';
import { UIPluginPackage } from '@embedpdf/plugin-ui/react';
// ... 其他插件

function CustomPdfViewer() {
    const { engine, isLoading, error } = usePdfiumEngine();
    
    const plugins = [
        createPluginRegistration(ViewportPluginPackage, {
            viewportGap: 10,
        }),
        createPluginRegistration(ScrollPluginPackage, {
            defaultStrategy: ScrollStrategy.Vertical,
        }),
        createPluginRegistration(UIPluginPackage, {
            // 自定义 UI 配置
        }),
        // ... 添加所需插件
    ];
    
    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;
    
    return (
        <EmbedPDF engine={engine} plugins={plugins}>
            {/* 自定义组件 */}
        </EmbedPDF>
    );
}
```

## 三、VSCode 插件集成方案

### 3.1 VSCode WebView 架构

VSCode 插件需要使用 WebView API 来显示 PDF 内容。WebView 是一个独立的 iframe 环境，有自己的 DOM 和 JavaScript 上下文。

```
VSCode 插件架构
├── Extension Host (Node.js 环境)
│   ├── 插件激活逻辑
│   ├── 命令注册
│   └── WebView 管理
└── WebView (浏览器环境)
    ├── HTML + CSS + JavaScript
    └── EmbedPDF 查看器
```

### 3.2 实现步骤

#### 步骤 1: 创建 VSCode 插件基础结构

```typescript
// extension.ts - 主入口文件
import * as vscode from 'vscode';
import { PdfViewerPanel } from './pdfViewerPanel';

export function activate(context: vscode.ExtensionContext) {
    // 注册打开 PDF 的命令
    let disposable = vscode.commands.registerCommand(
        'embedpdf.openPdf',
        (uri?: vscode.Uri) => {
            PdfViewerPanel.createOrShow(context.extensionUri, uri);
        }
    );
    
    context.subscriptions.push(disposable);
    
    // 注册自定义编辑器（可选，用于默认打开 PDF）
    const provider = new PdfEditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'embedpdf.pdfEditor',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            }
        )
    );
}
```

#### 步骤 2: 创建 WebView 面板

```typescript
// pdfViewerPanel.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class PdfViewerPanel {
    public static currentPanel: PdfViewerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    
    public static createOrShow(
        extensionUri: vscode.Uri,
        pdfUri?: vscode.Uri
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        
        // 如果面板已存在，显示它
        if (PdfViewerPanel.currentPanel) {
            PdfViewerPanel.currentPanel._panel.reveal(column);
            if (pdfUri) {
                PdfViewerPanel.currentPanel.loadPdf(pdfUri);
            }
            return;
        }
        
        // 创建新面板
        const panel = vscode.window.createWebviewPanel(
            'embedpdfViewer',
            'PDF Viewer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                ]
            }
        );
        
        PdfViewerPanel.currentPanel = new PdfViewerPanel(
            panel,
            extensionUri,
            pdfUri
        );
    }
    
    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        pdfUri?: vscode.Uri
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        
        // 设置初始 HTML 内容
        this._update();
        
        // 如果提供了 PDF URI，加载它
        if (pdfUri) {
            this.loadPdf(pdfUri);
        }
        
        // 监听面板关闭事件
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // 处理来自 WebView 的消息
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'ready':
                        console.log('PDF viewer ready');
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            },
            null,
            this._disposables
        );
    }
    
    public loadPdf(uri: vscode.Uri) {
        // 读取 PDF 文件并发送到 WebView
        vscode.workspace.fs.readFile(uri).then(data => {
            const base64 = Buffer.from(data).toString('base64');
            this._panel.webview.postMessage({
                type: 'loadPdf',
                data: base64,
                filename: path.basename(uri.fsPath)
            });
        });
    }
    
    public dispose() {
        PdfViewerPanel.currentPanel = undefined;
        
        this._panel.dispose();
        
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    
    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // 获取资源路径
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'embedpdf.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'embedpdf.css')
        );
        
        // 生成 nonce 用于 CSP
        const nonce = getNonce();
        
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
                           worker-src blob:;">
            <title>PDF Viewer</title>
            <link href="${styleUri}" rel="stylesheet">
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    overflow: hidden;
                }
                #pdf-viewer {
                    width: 100%;
                    height: 100vh;
                }
            </style>
        </head>
        <body>
            <div id="pdf-viewer"></div>
            <script nonce="${nonce}" type="module">
                import EmbedPDF from '${scriptUri}';
                
                const vscode = acquireVsCodeApi();
                let viewer = null;
                
                // 初始化查看器
                function initViewer(pdfData) {
                    const container = document.getElementById('pdf-viewer');
                    
                    // 将 base64 转换为 Uint8Array
                    const binary = atob(pdfData);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    
                    viewer = EmbedPDF.init({
                        type: 'container',
                        target: container,
                        src: bytes,
                        theme: {
                            preference: 'system'
                        },
                        zoom: {
                            defaultLevel: 'fit-width'
                        }
                    });
                    
                    viewer.registry.then(registry => {
                        vscode.postMessage({ type: 'ready' });
                    }).catch(err => {
                        vscode.postMessage({ 
                            type: 'error', 
                            message: err.message 
                        });
                    });
                }
                
                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'loadPdf':
                            if (viewer) {
                                // 清理旧的查看器
                                document.getElementById('pdf-viewer').innerHTML = '';
                            }
                            initViewer(message.data);
                            break;
                    }
                });
                
                // 通知扩展 WebView 已准备好
                vscode.postMessage({ type: 'webviewReady' });
            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
```

#### 步骤 3: 自定义编辑器提供程序（可选）

```typescript
// pdfEditorProvider.ts
import * as vscode from 'vscode';

export class PdfEditorProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}
    
    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return {
            uri,
            dispose: () => {}
        };
    }
    
    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
            ]
        };
        
        // 使用与 PdfViewerPanel 类似的逻辑设置 WebView
        // ...
    }
}
```

### 3.3 package.json 配置

```json
{
    "name": "embedpdf-vscode",
    "displayName": "EmbedPDF Viewer",
    "description": "PDF viewer for VSCode using EmbedPDF",
    "version": "1.0.0",
    "engines": {
        "vscode": "^1.80.0"
    },
    "categories": ["Other"],
    "activationEvents": [
        "onCommand:embedpdf.openPdf",
        "onCustomEditor:embedpdf.pdfEditor"
    ],
    "main": "./dist/extension.js",
    "contributes": {
        "commands": [
            {
                "command": "embedpdf.openPdf",
                "title": "Open PDF with EmbedPDF",
                "category": "EmbedPDF"
            }
        ],
        "customEditors": [
            {
                "viewType": "embedpdf.pdfEditor",
                "displayName": "PDF Viewer",
                "selector": [
                    {
                        "filenamePattern": "*.pdf"
                    }
                ],
                "priority": "option"
            }
        ],
        "menus": {
            "explorer/context": [
                {
                    "command": "embedpdf.openPdf",
                    "when": "resourceExtname == .pdf",
                    "group": "navigation"
                }
            ]
        }
    }
}
```

### 3.4 构建配置

需要将 EmbedPDF 的资源文件打包到插件中：

```javascript
// webpack.config.js
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    target: 'node',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: 'ts-loader'
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: 'node_modules/@embedpdf/snippet/dist',
                    to: 'dist'
                }
            ]
        })
    ]
};
```

## 四、关键集成要点

### 4.1 PDF 数据加载

EmbedPDF 支持多种数据源：

```typescript
// 方式 1: URL
viewer = EmbedPDF.init({
    type: 'container',
    target: container,
    src: 'https://example.com/document.pdf'
});

// 方式 2: Uint8Array (适合 VSCode)
const pdfBytes = new Uint8Array(buffer);
viewer = EmbedPDF.init({
    type: 'container',
    target: container,
    src: pdfBytes
});

// 方式 3: Base64
viewer = EmbedPDF.init({
    type: 'container',
    target: container,
    src: 'data:application/pdf;base64,JVBERi0xLjQK...'
});
```

### 4.2 插件注册表访问

通过插件注册表可以访问所有功能：

```typescript
const registry = await viewer.registry;

// 获取缩放插件
const zoomPlugin = registry.getPlugin(ZoomPlugin);
await zoomPlugin.setZoomLevel(1.5);

// 获取搜索插件
const searchPlugin = registry.getPlugin(SearchPlugin);
await searchPlugin.search('keyword');

// 获取注释插件
const annotationPlugin = registry.getPlugin(AnnotationPlugin);
```

### 4.3 主题集成

EmbedPDF 支持 VSCode 主题集成：

```typescript
// 在 WebView 中检测 VSCode 主题
const body = document.body;
const theme = body.classList.contains('vscode-dark') ? 'dark' : 'light';

viewer = EmbedPDF.init({
    type: 'container',
    target: container,
    src: pdfData,
    theme: {
        preference: theme
    }
});

// 监听 VSCode 主题变化
const observer = new MutationObserver(() => {
    const newTheme = body.classList.contains('vscode-dark') ? 'dark' : 'light';
    viewer.setTheme(newTheme);
});

observer.observe(body, {
    attributes: true,
    attributeFilter: ['class']
});
```

### 4.4 性能优化

对于 VSCode 插件，建议：

1. **启用 retainContextWhenHidden**: 保持 WebView 状态
2. **延迟加载**: 只在需要时初始化查看器
3. **资源缓存**: 缓存常用的 PDF 文件
4. **内存管理**: 及时清理不用的查看器实例

```typescript
const panel = vscode.window.createWebviewPanel(
    'embedpdfViewer',
    'PDF Viewer',
    column,
    {
        enableScripts: true,
        retainContextWhenHidden: true,  // 重要！
        localResourceRoots: [...]
    }
);
```

## 五、高级功能集成

### 5.1 自定义工具栏

```typescript
viewer = EmbedPDF.init({
    type: 'container',
    target: container,
    src: pdfData,
    ui: {
        toolbar: {
            position: 'top',
            items: [
                { type: 'command', command: 'zoom-in' },
                { type: 'command', command: 'zoom-out' },
                { type: 'divider' },
                { type: 'command', command: 'search' },
                { type: 'spacer' },
                { type: 'command', command: 'fullscreen' }
            ]
        }
    }
});
```

### 5.2 事件监听

```typescript
const registry = await viewer.registry;
const scrollPlugin = registry.getPlugin(ScrollPlugin);

// 监听页面变化
scrollPlugin.on('page-change', (event) => {
    console.log('Current page:', event.pageNumber);
    // 通知 VSCode 扩展
    vscode.postMessage({
        type: 'pageChange',
        pageNumber: event.pageNumber
    });
});
```

### 5.3 注释功能

```typescript
const annotationPlugin = registry.getPlugin(AnnotationPlugin);

// 创建注释
await annotationPlugin.createAnnotation({
    type: PdfAnnotationSubtype.Highlight,
    pageIndex: 0,
    rect: [100, 100, 200, 120],
    color: [255, 255, 0]
});

// 监听注释变化
annotationPlugin.on('annotation-created', (event) => {
    console.log('New annotation:', event.annotation);
});
```

## 六、部署和分发

### 6.1 文件结构

```
embedpdf-vscode/
├── src/
│   ├── extension.ts
│   ├── pdfViewerPanel.ts
│   └── pdfEditorProvider.ts
├── dist/
│   ├── extension.js
│   ├── embedpdf.js      # 从 @embedpdf/snippet 复制
│   └── embedpdf.css     # 样式文件
├── package.json
├── tsconfig.json
└── webpack.config.js
```

### 6.2 依赖管理

```json
{
    "dependencies": {
        "@embedpdf/snippet": "^2.1.1"
    },
    "devDependencies": {
        "@types/vscode": "^1.80.0",
        "typescript": "^5.0.0",
        "webpack": "^5.0.0",
        "webpack-cli": "^5.0.0",
        "copy-webpack-plugin": "^11.0.0"
    }
}
```

## 七、总结

### UI 使用方式总结

1. **Snippet 方式**: 最简单，适合快速集成，通过 CDN 引入
2. **框架组件方式**: 适合 React/Vue/Svelte 应用
3. **核心 API 方式**: 适合深度定制，如 VSCode 插件

### VSCode 插件集成关键点

1. **使用 WebView API** 创建独立的查看器环境
2. **通过 postMessage** 实现扩展主进程和 WebView 通信
3. **将 PDF 数据转换为 Uint8Array** 传递给 EmbedPDF
4. **配置 CSP** 允许 WASM 执行
5. **集成 VSCode 主题系统**
6. **使用自定义编辑器** 实现默认 PDF 查看器

### 优势

- ✅ 完整的 PDF 查看功能（缩放、搜索、注释等）
- ✅ 现代化的 UI 界面
- ✅ 良好的性能（基于 PDFium）
- ✅ MIT 许可证，可商用
- ✅ 活跃的开发和社区支持

### 注意事项

- ⚠️ WASM 文件较大，需要考虑加载时间
- ⚠️ WebView 环境与 Node.js 环境隔离
- ⚠️ 需要正确配置 CSP 策略
- ⚠️ 注意内存管理，避免泄漏
