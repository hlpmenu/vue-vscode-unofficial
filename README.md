# Volar for Vue (For use with Tsgo Native Preview)

## Description

This is an unofficial extension that provides Vue language support for Visual Studio Code, designed to be compatible with the `typescript-native-preview` (tsgo) extension as it lacks support for TSServer plugins.

Additionally it provides a more robust auto-completions. 

The "workaround" is simply to run a standalone `tsserver` instance, with the `@vue/typescript-plugin` loaded.


Since this extension is **less** efficient than Volar, use Volar unless you are using the ts preview extension, or for some other reason do not have the vscode builtin tsserver enabled.

## Todo
- Add proper settings for logging
- Cleanup logging
- Add workflow to autorelease on tag

## Installation

[Install from the Visual Studio Code Marketplace (https://marketplace.visualstudio.com/items?itemName=hlmpn.vue-vscode-unofficial)]()

## Roadmap

A closer integration with tsgo is the goal, but for now, it runs its own instance of both vue lsp and tsserver.


## Features

Essentially Volar:s somewhat slower cousin, so:

*   **Syntax Highlighting:** Rich syntax highlighting for `.vue` files and embedded languages like Pug, SCSS, and TypeScript.
*   **IntelliSense:** Smart code completions, parameter info, and quick info for Vue components, props, and directives.
*   **Type Checking:** Real-time type checking for TypeScript code within `<script>` blocks.
*   **Diagnostics:** Error and warning reporting for both template and script sections.
*   **Go to Definition:** Navigate to the definition of components, props, and methods.
*   **Hover Information:** Display detailed information about symbols on hover.
*   **JSON Schema Validation:** Provides a Vue-specific schema for `tsconfig.json` and `jsconfig.json` files.

## Usage

No special configuration is required, just enable and write some vue code.

**Unless you feel like 2x the lsp-support means 2x the efficiency, dont use both this and the official Volar extension.**

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).