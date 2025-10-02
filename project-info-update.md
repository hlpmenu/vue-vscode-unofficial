# Project Information: Volar for Vue (Native TS)

## 1. The Problem: `tsgo` and Plugin Incompatibility

The official `typescript-native-preview` VS Code extension, which integrates the high-performance `tsgo` language server, lacks support for TSServer plugins. This is a critical feature relied upon by the original Volar extension, which uses `@vue/typescript-plugin` to provide TypeScript intelligence within `.vue` files (SFCs).

Without plugin support, the `tsgo` server cannot understand the `<script>` blocks of Vue components, leading to a loss of essential features like type-checking, completions, and hover information for TypeScript code in Vue projects.

## 2. The Solution: A Managed TSServer Bridge

This extension re-enables full Vue language support by running its own managed instance of the standard `tsserver` as a background process. This managed server is specifically configured to load the `@vue/typescript-plugin`, making it fully Vue-aware.

This architecture creates a "bridge" that allows the main Vue Language Server and the VS Code editor to communicate with a Vue-capable TypeScript server, restoring rich TypeScript functionality for `.vue` files.

## 3. Core Architecture & Data Flow

The extension operates through two primary data flow mechanisms:

### 3.1. Internal Bridge: Vue LS -> TSServer

The main `@vue/language-server` sends custom notifications when it needs data from the TypeScript language service.

-   **Path**: `Vue Language Server` -> `vue-ts-bridge.ts` -> `TsserverBridge` -> `Managed TSServer`
-   **Mechanism**:
    1.  The Vue LS sends a `tsserver/request` notification (e.g., for completions).
    2.  The `registerVueTsserverBridge` function in `src/vue-ts-bridge.ts` intercepts this notification.
    3.  It forwards the command to the managed `tsserver` via the `TsserverBridge`.
    4.  The response is sent back to the Vue LS via a `tsserver/response` notification.

### 3.2. External Bridge: VS Code -> Middleware -> TSServer

To provide LSP features directly to the editor, the extension uses a `vscode-languageclient` middleware layer.

-   **Path**: `VS Code Editor` -> `LSP Middleware` -> `TsserverBridge` -> `Managed TSServer`
-   **Mechanism**:
    1.  The `createMiddleware` function (`src/middleware/middleware.ts`) intercepts standard LSP requests from the editor (e.g., `provideHover`).
    2.  The handler for each feature (e.g., `src/middleware/hover.ts`) calls the managed `tsserver` using special `_vue:` prefixed commands (e.g., `_vue:quickinfo`) to activate the `@vue/typescript-plugin`.
    3.  The middleware logic merges results from the managed `tsserver` with results from the main Vue LS to provide a complete and accurate response to the editor.

## 4. Key Components

-   **`index.ts`**: The extension's entry point. It initializes the `VueLanguageClient`, spawns the `TsserverBridge`, and injects the LSP middleware.
-   **`TsserverBridge` (`src/tsserver/bridge.ts`)**: The core class that spawns and manages the `tsserver` child process, handling all low-level `stdio` communication.
-   **Typed TSServer Protocol**: The project utilizes a custom-generated `.d.ts` file, providing strong TypeScript types for the `tsserver` protocol, which ensures type safety for all bridged requests and responses.

## 5. Comprehensive Language Feature Support

Beyond the bridging architecture, this extension provides a full suite of language features for Vue, inherited from Volar. As defined in `package.json`, it is also responsible for:

-   **Syntax Highlighting**: Providing rich TextMate grammars for `.vue` files and their embedded languages (Pug, SCSS, TS, etc.).
-   **Language Configuration**: Defining language basics like bracket pairs and comment styles.
-   **JSON Schema Validation**: Supplying a Vue-specific schema for `tsconfig.json` and `jsconfig.json` files.
-   **Semantic Highlighting**: Enabling more intelligent, context-aware highlighting for Vue-specific constructs like component tags.
