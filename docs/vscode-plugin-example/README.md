# VSCode 插件示例代码

本目录包含一个完整的 VSCode 插件示例，演示如何集成 EmbedPDF 查看器。

## 快速开始

### 1. 创建项目结构

```bash
mkdir embedpdf-vscode
cd embedpdf-vscode
npm init -y
```

### 2. 安装依赖

```bash
npm install --save @embedpdf/snippet

npm install --save-dev \
  @types/vscode \
  @types/node \
  typescript \
  webpack \
  webpack-cli \
  ts-loader \
  copy-webpack-plugin
```

### 3. 配置 TypeScript

创建 `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "out",
    "sourceMap": true,
    "strict": true,
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", ".vscode-test"]
}
```

### 4. 配置 Webpack

创建 `webpack.config.js`:

```javascript
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
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
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'node_modules/@embedpdf/snippet/dist',
          to: 'webview'
        }
      ]
    })
  ]
};
```

### 5. 创建源代码文件

参见以下文件：
- `src/extension.ts` - 插件入口
- `src/pdfViewerPanel.ts` - WebView 面板管理
- `src/pdfEditorProvider.ts` - 自定义编辑器

### 6. 配置 package.json

```json
{
  "name": "embedpdf-vscode",
  "displayName": "EmbedPDF Viewer",
  "description": "PDF viewer for VSCode using EmbedPDF",
  "version": "1.0.0",
  "publisher": "your-publisher-name",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
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
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "webpack",
    "watch": "webpack --watch",
    "package": "vsce package",
    "publish": "vsce publish"
  },
  "dependencies": {
    "@embedpdf/snippet": "^2.1.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.80.0",
    "copy-webpack-plugin": "^11.0.0",
    "ts-loader": "^9.5.0",
    "typescript": "^5.0.0",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.0"
  }
}
```

### 7. 构建和测试

```bash
# 编译
npm run compile

# 调试：按 F5 在 VSCode 中启动调试
# 这将打开一个新的 Extension Development Host 窗口

# 打包
npm run package
```

## 使用方法

1. 在 VSCode 中，右键点击任何 `.pdf` 文件
2. 选择 "Open PDF with EmbedPDF"
3. PDF 将在新的 WebView 面板中打开

或者：

1. 右键点击 `.pdf` 文件
2. 选择 "Open With..."
3. 选择 "PDF Viewer"（如果设置为默认）

## 特性

- ✅ 完整的 PDF 查看功能
- ✅ 缩放、旋转、搜索
- ✅ 注释和高亮
- ✅ 自动主题切换（跟随 VSCode 主题）
- ✅ 多文件支持

## 自定义配置

可以在 VSCode 设置中添加自定义配置：

```json
{
  "embedpdf.defaultZoom": "fit-width",
  "embedpdf.enableAnnotations": true,
  "embedpdf.author": "Your Name"
}
```

然后在代码中读取这些配置：

```typescript
const config = vscode.workspace.getConfiguration('embedpdf');
const defaultZoom = config.get<string>('defaultZoom', 'fit-width');
```

## 高级功能

### 添加自定义命令

在 WebView 中添加自定义按钮，发送命令到扩展：

```typescript
// WebView 中
vscode.postMessage({
  type: 'custom-command',
  command: 'export-annotations'
});

// 扩展中
this._panel.webview.onDidReceiveMessage(message => {
  switch (message.type) {
    case 'custom-command':
      if (message.command === 'export-annotations') {
        // 导出注释逻辑
      }
      break;
  }
});
```

### 状态持久化

使用 WebView 状态保存用户的查看位置：

```typescript
// WebView 中保存状态
const state = vscode.getState() || {};
state.currentPage = pageNumber;
vscode.setState(state);

// 恢复状态
const previousState = vscode.getState();
if (previousState && previousState.currentPage) {
  // 跳转到上次的页面
}
```

## 故障排除

### WASM 加载失败

确保 CSP 中包含 `'wasm-unsafe-eval'`:

```typescript
content="script-src 'nonce-${nonce}' 'wasm-unsafe-eval';"
```

### 资源路径问题

使用 `webview.asWebviewUri()` 转换所有资源路径：

```typescript
const scriptUri = webview.asWebviewUri(
  vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'embedpdf.js')
);
```

### 主题不匹配

监听 VSCode 主题变化并同步到 WebView：

```typescript
vscode.window.onDidChangeActiveColorTheme((theme) => {
  panel.webview.postMessage({
    type: 'theme-change',
    theme: theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
  });
});
```
