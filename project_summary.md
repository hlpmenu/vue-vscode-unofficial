<project_information>
    <summary>
        This Visual Studio Code extension is a specialized version of the Volar Vue language server, designed to be compatible with the `typescript-native-preview` (tsgo) extension.
    </summary>
    <problem_solved>
        The official `typescript-native-preview` extension enhances VS Code by using the faster `tsgo` language server. However, it removes the traditional `typescript.*` command API and does not support language server plugins. This breaks the standard Volar extension, which relies on patching the built-in TypeScript server to add Vue-specific functionality.
    </problem_solved>
    <architecture>
        Instead of trying to patch the un-patchable `tsgo` server, this extension implements a self-contained solution by coordinating several components:
        <component id="managed_typescript_server">
            <title>Managed TypeScript Server</title>
            <description>It programmatically launches its own instance of the standard `tsserver.js`. This server is kept completely separate from VS Code's built-in `tsgo`.</description>
        </component>
        <component id="vue_typescript_plugin">
            <title>Vue TypeScript Plugin</title>
            <description>This dedicated `tsserver` instance is configured to load the `@vue/typescript-plugin`, enabling it to understand the `<script>` blocks within `.vue` files.</description>
        </component>
        <component id="vue_language_server">
            <title>Vue Language Server</title>
            <description>It runs the official `@vue/language-server`. Using `vscode-languageclient`, this server is registered to handle files with the `vue` language ID, providing language features for Vue-specific parts of a file, like the template and style blocks.</description>
        </component>
    </architecture>
</project_information>
