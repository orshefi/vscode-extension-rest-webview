# VS Code REST Webview Example - Bundled

This example demonstrates how to create a VS Code extension with a bundled webview that uses the published `@vscode-rest/client` npm package for HTTP-like communication.

## Features

- **Bundled Webview**: Uses Webpack to bundle the webview TypeScript, CSS, and HTML into optimized assets
- **Separate Concerns**: Clean separation between extension logic and webview code
- **TypeScript Support**: Full TypeScript support for both extension and webview code
- **Hot Reload**: Development mode with automatic rebuilding on changes
- **Modern Build System**: Uses Webpack with TypeScript loader and CSS processing

## Project Structure

```
src/
├── extension.ts          # Main extension code
└── webview/
    ├── index.ts         # Webview JavaScript logic
    ├── index.html       # Webview HTML template
    ├── styles.css       # Webview CSS styles
    └── tsconfig.json    # TypeScript config for webview (includes DOM types)
dist/
├── extension.js         # Compiled extension
├── webview.js           # Bundled webview script
└── webview.html         # Processed HTML with bundled assets
```

## Build Scripts

- `npm run build` - Build both extension and webview
- `npm run build:extension` - Build only the extension TypeScript
- `npm run build:webview` - Build only the webview bundle
- `npm run dev` - Watch mode for both extension and webview
- `npm run dev:extension` - Watch mode for extension only
- `npm run dev:webview` - Watch mode for webview only
- `npm run clean` - Clean the dist directory

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Or run in development mode with hot reload:
   ```bash
   npm run dev
   ```

4. Open the project in VS Code and press `F5` to run the extension

5. Open the command palette (`Cmd+Shift+P`) and run "Open REST Webview Example"

## Key Features

### Webpack Configuration

The `webpack.config.js` configures:
- TypeScript compilation with DOM types for webview code
- CSS processing with style-loader and css-loader
- HTML template processing with HtmlWebpackPlugin
- Source maps for debugging

### Separate TypeScript Configs

- Main `tsconfig.json` - Excludes webview files, uses Node.js types
- `src/webview/tsconfig.json` - Includes DOM types for browser APIs

### Webview Asset Loading

The extension automatically:
- Reads the bundled HTML and JavaScript from the `dist` folder
- Converts local paths to VS Code webview URIs for security
- Provides fallback error handling if bundled assets aren't found

## API Endpoints

The example includes several REST endpoints:

- `GET /api/hello` - Returns a greeting message
- `GET /api/users` - Returns a list of sample users
- `GET /api/workspace` - Returns workspace information
- `POST /api/users` - Creates a new user

## Benefits of Bundling

1. **Performance**: Single bundled JavaScript file loads faster
2. **Dependency Management**: Proper handling of published npm dependencies
3. **Modern Tooling**: TypeScript, CSS processing, and other modern web tools
4. **Code Splitting**: Potential for advanced optimization techniques
5. **Development Experience**: Hot reloading and source maps for debugging
6. **Distribution**: Uses published npm packages for easy installation and updates 