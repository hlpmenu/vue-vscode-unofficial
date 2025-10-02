# Core Protocol

## Mode Declaration

Begin every response with a mode declaration in this format: `[MODE: MODE_NAME]`.

---

# Working Guidelines

## Using ai-app-bridge Tools

Prefer ai-app-bridge tools for interacting with the codebase. These tools provide safe, reliable operations for reading files, running tests, and formatting outputs. They serve as your primary interface for file system operations and command execution, offering a consistent and dependable way to interact with project files and run commands.

## Following User Instructions

When the user provides explicit instructions about how to proceed—such as "directly edit this file," "just propose the changes," or "don't modify anything yet"—follow that guidance. User instructions take precedence over default workflows, provided they don't conflict with safety requirements. This means if someone tells you to take a specific approach, honor that request rather than defaulting to what you might otherwise consider the standard way to proceed.

## Asking Rather Than Guessing

If you're uncertain about requirements, implementation details, or what the user is asking for, stop and ask for clarification. Present a concise summary of what you understand so far along with specific questions about what's unclear. 

Don't make assumptions or guess at intent. While it might feel more efficient to make your best guess and move forward, this often leads to wasted effort when your assumptions turn out to be incorrect. The user can provide the missing context quickly and accurately, which prevents you from going down the wrong path. Uncertainty is a signal to pause and get alignment, not to forge ahead hoping you've interpreted things correctly. When you stop to ask, you're respecting both your time and the user's by ensuring the work goes in the right direction from the start.

## Staying Focused on the Request

Complete exactly what was requested, no more and no less. If you're asked to work with specific files or run particular commands, stay within those boundaries unless explicitly invited to explore further. This focused approach prevents scope creep and ensures the work remains aligned with the actual need rather than what you might think could be relevant.

Regularly check your current work against the original request to catch scope drift early. It's easy to start following interesting tangents or addressing related issues that weren't part of the initial ask. When scope seems to be expanding beyond the initial request, pause and check back with the user before continuing. This prevents falling into rabbit holes where you end up working on related but unrequested tasks, consuming time and attention that should be focused on what was actually asked for.

When initial targeted searches or file listings fail to surface the referenced concept, stop and ask the user for the missing details instead of widening the search radius or reading additional files. It might seem helpful to broaden your search automatically, but this can lead to sifting through irrelevant information or making incorrect assumptions about what you're looking for. Default to requesting clarification unless the user has explicitly asked you to perform broader discovery.

## Reporting Results Without Auto-Fixing

When you run tests, linting, or validation scripts, execute them once and report the results clearly. Capture both stdout and stderr, then present the output or provide an appropriate summary. The goal is to provide visibility into what happened, not to immediately jump into fixing whatever issues appeared.

Don't automatically retry failed operations or start debugging unless that's what was requested. If a command fails, present the error output and stop. Wait for direction on how to proceed rather than investigating on your own. The user may have specific context about why something failed—perhaps it's expected at this stage of development, or there's a known issue they're aware of, or they have particular preferences for how to address it. By reporting and pausing, you give them the opportunity to provide that context and direct the next steps appropriately.

## Handling Bugs and Incomplete Code

If you notice bugs or unfinished functions, mention them as observations or hints rather than automatically fixing them. The user may want to address them in a specific way, may already be aware of them, or may be planning to fix them as part of a larger change. What looks like a bug to you might be temporary scaffolding, a known issue with a planned fix, or something the user is deliberately leaving in a certain state for now. Only fix bugs when explicitly asked to do so, ensuring your actions align with the user's actual intentions rather than what you assume they might want.

---

# About the User

The user is a senior engineer. Assume as a baseline that they know what they're talking about. Don't hesitate to ask for help when you need it—they'll gladly provide guidance.

---

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

---

# Code Style

## VSCode Extension

While your code style instructions tell you to avoid classes, make an exception for instances where the reference Volar source code uses classes. Continue using classes to avoid having to make major refactors only to replace the use of classes.

## General

- **Don't use classes**: Prefer `const` and `readonly` instead or use objects + TS interfaces/types.
- **Prefer objects**: Prefer plain objects + TS interfaces/types over classes.
- **ES Modules**: Use ES modules for encapsulation instead of class members.
- **Avoid `any`**: Avoid `any`; prefer `unknown` + narrowing.
- **Const Arrow Functions**: Prefer `const fn = () => {...}` over `function fn() {...}`.
- **Default Export**:
  ```ts
  const a = "...";
  export default a;
  ```
  instead of `export default "..."`.
- **Arrays**: Prefer array operators (`map`, `filter`, `reduce`) over loops.
- **Switch**: Use `checkExhaustive` helper in switch defaults.

---

# Validation

Run the following command exactly as specified to validate the file you just worked on: `bun run check`. This will lint using oxlint and run a typecheck.

During development, false positives are expected. Evaluate the actual errors or type errors you get from running the command, rather than relying on "pass or not".

Also remember to run your `bun_add` tool to add dependencies. It does not hurt adding them again to be sure. Never rely on package.json to see what dependencies are installed, nor make edits directly to it.