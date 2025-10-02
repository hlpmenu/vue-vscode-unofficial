<about_project>
    <problem_statement>
        The official `typescript-native-preview` VS Code extension (`tsgo`) lacks support for TSServer plugins. This breaks extensions like Volar, which rely on `@vue/typescript-plugin` to provide TypeScript intelligence within `.vue` Single File Components (SFCs). Without this plugin, essential features like type-checking, completions, and hover information for TypeScript code inside Vue files are lost.
    </problem_statement>

    <solution_overview>
        This extension re-enables full Vue language support by running its own managed instance of the standard `tsserver` as a background process. This managed server is explicitly configured to load the `@vue/typescript-plugin`, making it fully Vue-aware. This architecture acts as a "bridge," allowing the main Vue Language Server and the VS Code editor to communicate with a Vue-capable TypeScript server, restoring rich TypeScript functionality for `.vue` files.
    </solution_overview>

    <architecture>
        <component name="Managed TSServer (`TsserverBridge`)">
            - The core of the extension, defined in `src/tsserver/bridge.ts`.
            - Spawns and manages a `tsserver` child process.
            - Handles all low-level stdio communication.
            - Injects the `--globalPlugins=@vue/typescript-plugin` and `--pluginProbeLocations` arguments to ensure the Vue plugin is loaded.
        </component>
        <component name="LSP Middleware">
            - Defined in `src/middleware/middleware.ts`.
            - Intercepts standard LSP requests from the VS Code editor (e.g., `provideHover`).
            - Orchestrates calls to the managed `tsserver` and the main Vue Language Server to provide rich editor features.
        </component>
        <component name="Internal Notification Bridge">
            - Defined in `src/vue-ts-bridge.ts`.
            - Forwards requests from the main `@vue/language-server` to the managed `tsserver`.
        </component>
        <component name="Language Feature Contributions">
            - Defined in `package.json`.
            - Provides comprehensive language support beyond the bridge, including:
                - Rich TextMate grammars for syntax highlighting of `.vue` files and embedded languages.
                - Language configuration for brackets and comments.
                - A Vue-specific JSON schema for `tsconfig.json`.
                - Semantic highlighting scopes for Vue constructs.
        </component>
    </architecture>

    <data_flow>
        <flow id="internal_bridge">
            <description>Handles requests originating from the main Vue Language Server when it needs TypeScript information.</description>
            <steps>
                1. `@vue/language-server` sends a `tsserver/request` notification.
                2. `src/vue-ts-bridge.ts` intercepts the notification.
                3. The request is forwarded to the `TsserverBridge`.
                4. The `TsserverBridge` sends the command to the managed `tsserver` process.
                5. The response is returned to the `@vue/language-server` via a `tsserver/response` notification.
            </steps>
        </flow>
        <flow id="external_bridge">
            <description>Handles LSP requests originating from the VS Code editor for features like hover, definitions, etc.</description>
            <steps>
                1. The LSP Middleware intercepts a standard editor request (e.g., `provideHover`).
                2. The relevant handler (e.g., `src/middleware/hover.ts`) calls the `TsserverBridge` with a special `_vue:` prefixed command (e.g., `_vue:quickinfo`) to activate the Vue plugin.
                3. The handler may also call `next()` to get results from the main `@vue/language-server`.
                4. The results from both sources are merged to provide a complete response to the editor.
            </steps>
        </flow>
    </data_flow>
</about_project>
