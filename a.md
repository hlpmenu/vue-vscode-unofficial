<material>
<oxlint_reference lang="json">
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": [ "typescript", "react", "unicorn" ],
  "categories": {
    "correctness": "off"
  },
  "env": {
    "builtin": true
  },
  "ignorePatterns": [
    "node_modules/*",
    ".integration-tests/**",
    "eslint.config.js",
    "packages/**/dist/**",
    "bundle/**",
    "package/bundle/**",
    "dist/**",
    "**/node_modules/**",
    "**/.git/**",
    "**/.vscode/**",
    "**/dist /**",
    "**/bundle/**",
    "packages/vscode-ide-companion/esbuild.js",
    "scripts/**"
  ],
  "rules": {
    "for-direction": "error",
    "no-async-promise-executor": "error",
    "no-case-declarations": "error",
    "no-class-assign": "error",
    "no-compare-neg-zero": "error",
    "no-cond-assign": "error",
    "no-const-assign": "error",
    "no-constant-binary-expression": "error",
    "no-constant-condition": "error",
    "no-control-regex": "error",
    "no-debugger": "error",
    "no-delete-var": "error",
    "no-dupe-class-members": "error",
    "no-dupe-else-if": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty": "error",
    "no-empty-character-class": "error",
    "no-empty-pattern": "error",
    "no-empty-static-block": "error",
    "no-ex-assign": "error",
    "no-extra-boolean-cast": "error",
    "no-fallthrough": "error",
    "no-func-assign": "error",
    "no-global-assign": "error",
    "no-import-assign": "error",
    "no-invalid-regexp": "error",
    "no-irregular-whitespace": "error",
    "no-loss-of-precision": "error",
    "no-new-native-nonconstructor": "error",
    "no-nonoctal-decimal-escape": "error",
    "no-obj-calls": "error",
    "no-prototype-builtins": "error",
    "no-redeclare": "error",
    "no-regex-spaces": "error",
    "no-self-assign": "error",
    "no-setter-return": "error",
    "no-shadow-restricted-names": "error",
    "no-sparse-arrays": "error",
    "no-this-before-super": "error",
    "no-unexpected-multiline": "off",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "no-unsafe-optional-chaining": "error",
    "no-unused-labels": "error",
    "no-unused-private-class-members": "error",
    "no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],
    "no-useless-backreference": "error",
    "no-useless-catch": "error",
    "no-useless-escape": "error",
    "no-with": "error",
    "require-yield": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
    "@typescript-eslint/ban-ts-comment": "error",
    "no-array-constructor": "error",
    "@typescript-eslint/no-duplicate-enum-values": "error",
    "@typescript-eslint/no-empty-object-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-extra-non-null-assertion": "error",
    "@typescript-eslint/no-misused-new": "error",
    "@typescript-eslint/no-namespace": "error",
    "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
    "@typescript-eslint/no-require-imports": "error",
    "@typescript-eslint/no-this-alias": "error",
    "@typescript-eslint/no-unnecessary-type-constraint": "error",
    "@typescript-eslint/no-unsafe-declaration-merging": "error",
    "@typescript-eslint/no-unsafe-function-type": "error",
    "no-unused-expressions": "error",
    "@typescript-eslint/no-wrapper-object-types": "error",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/prefer-namespace-keyword": "error",
    "@typescript-eslint/triple-slash-reference": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-key": "warn",
    "react/jsx-no-comment-textnodes": "warn",
    "react/jsx-no-duplicate-props": "warn",
    "react/jsx-no-target-blank": "warn",
    "react/jsx-no-undef": "warn",
    "react/no-children-prop": "warn",
    "react/no-danger-with-children": "warn",
    "react/no-direct-mutation-state": "warn",
    "react/no-find-dom-node": "warn",
    "react/no-is-mounted": "warn",
    "react/no-render-return-value": "warn",
    "react/no-string-refs": "warn",
    "react/no-unescaped-entities": "warn",
    "react/no-unknown-property": "warn",
    "react/react-in-jsx-scope": "off",
    "curly": "off",
    "unicorn/empty-brace-spaces": "off",
    "unicorn/no-nested-ternary": "off",
    "unicorn/number-literal-case": "off"
  },
  "overrides": [
    {
      "files": [ "**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts" ],
      "rules": {
        "no-class-assign": "off",
        "no-const-assign": "off",
        "no-dupe-class-members": "off",
        "no-dupe-keys": "off",
        "no-func-assign": "off",
        "no-import-assign": "off",
        "no-new-native-nonconstructor": "off",
        "no-obj-calls": "off",
        "no-redeclare": "off",
        "no-setter-return": "off",
        "no-this-before-super": "off",
        "no-unsafe-negation": "off",
        "no-var": "error",
        "no-with": "off",
        "prefer-rest-params": "error",
        "prefer-spread": "error"
      }
    },
    {
      "files": [ "packages/cli/src/**/*.{ts,tsx}" ],
      "rules": {
        "import/namespace": "error",
        "import/default": "error",
        "import/no-named-as-default": "warn",
        "import/no-named-as-default-member": "warn",
        "import/no-duplicates": "warn",
        "import/no-default-export": "warn"
      },
      "plugins": [ "import" ]
    },
    {
      "files": [ "packages/*/src/**/*.{ts,tsx}" ],
      "rules": {
        "@typescript-eslint/array-type": [
          "error",
          {
            "default": "array-simple"
          }
        ],
        "arrow-body-style": [ "error", "as-needed" ],
        "curly": [ "error", "multi-line" ],
        "eqeqeq": [
          "error",
          "always",
          {
            "null": "ignore"
          }
        ],
        "@typescript-eslint/no-inferrable-types": [
          "error",
          {
            "ignoreParameters": true,
            "ignoreProperties": true
          }
        ],
        "@typescript-eslint/consistent-type-imports": [
          "error",
          {
            "disallowTypeAnnotations": false
          }
        ],
        "@typescript-eslint/no-namespace": [
          "error",
          {
            "allowDeclarations": true
          }
        ],
        "no-unused-expressions": [
          "error",
          {
            "allowShortCircuit": true,
            "allowTernary": true
          }
        ],
        "no-var": "error",
        "radix": "error",
        "default-case": "error",
        "no-unused-vars": [
          "error",
          {
            "argsIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "caughtErrorsIgnorePattern": "^_"
          }
        ]
      },
      "env": {
        "commonjs": true,
        "es2024": true,
        "node": true,
        "shared-node-browser": true
      }
    },
    {
      "files": [ "packages/*/src/**/*.test.{ts,tsx}" ],
      "rules": {
        "vitest/expect-expect": "off",
        "vitest/no-identical-title": "error",
        "vitest/no-commented-out-tests": "off",
        "vitest/valid-expect": "error",
        "vitest/valid-describe-callback": "error",
        "vitest/require-local-test-context-for-concurrent-snapshots": "error",
        "vitest/no-import-node-test": "error",
        "vitest/no-conditional-tests": "off",

      },
      "plugins": [ "vitest" ]
    },
    {
      "files": [ "./scripts/**/*.js", "esbuild.config.js" ],
      "rules": {
        "no-unused-vars": [
          "error",
          {
            "argsIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "caughtErrorsIgnorePattern": "^_"
          }
        ]
      },
      "env": {
        "commonjs": true,
        "node": true,
        "shared-node-browser": true
      }
    },
    {
      "files": [ "packages/vscode-ide-companion/esbuild.js" ],
      "rules": {
        "@typescript-eslint/no-require-imports": "off"
      },
      "env": {
        "commonjs": true,
        "node": true,
        "shared-node-browser": true
      }
    },
    {
      "files": [ "packages/vscode-ide-companion/scripts/**/*.js" ],
      "rules": {
        "@typescript-eslint/no-require-imports": "off"
      },
      "env": {
        "commonjs": true,
        "node": true,
        "shared-node-browser": true
      }
    },
    {
      "files": [ "./integration-tests/**/*.js" ],
      "rules": {
        "no-unused-vars": [
          "error",
          {
            "argsIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "caughtErrorsIgnorePattern": "^_"
          }
        ]
      },
      "env": {
        "commonjs": true,
        "node": true,
        "shared-node-browser": true
      }
    },
    {
      "files": [
        "scripts/**/*.ts",
        "packages/vscode-ide-companion/scripts/**/*.ts",
        "package/vscode-ide-companion/esbuild.ts"
      ],
      "rules": { },
      "plugins": [ "import" ]
    },
    {
      "files": [ "eslint.config.js" ],
      "rules": {
        "for-direction": "error",
        "no-async-promise-executor": "error",
        "no-case-declarations": "error",
        "no-class-assign": "error",
        "no-compare-neg-zero": "error",
        "no-cond-assign": "error",
        "no-const-assign": "error",
        "no-constant-binary-expression": "error",
        "no-constant-condition": "error",
        "no-control-regex": "error",
        "no-debugger": "error",
        "no-delete-var": "error",
        "no-dupe-class-members": "error",
        "no-dupe-else-if": "error",
        "no-dupe-keys": "error",
        "no-duplicate-case": "error",
        "no-empty": "error",
        "no-empty-character-class": "error",
        "no-empty-pattern": "error",
        "no-empty-static-block": "error",
        "no-ex-assign": "error",
        "no-extra-boolean-cast": "error",
        "no-fallthrough": "error",
        "no-func-assign": "error",
        "no-global-assign": "error",
        "no-import-assign": "error",
        "no-invalid-regexp": "error",
        "no-irregular-whitespace": "error",
        "no-loss-of-precision": "error",
        "no-new-native-nonconstructor": "error",
        "no-nonoctal-decimal-escape": "error",
        "no-obj-calls": "error",
        "no-prototype-builtins": "error",
        "no-redeclare": "error",
        "no-regex-spaces": "error",
        "no-self-assign": "error",
        "no-setter-return": "error",
        "no-shadow-restricted-names": "error",
        "no-sparse-arrays": "error",
        "no-this-before-super": "error",
        "no-unexpected-multiline": "off",
        "no-unsafe-finally": "error",
        "no-unsafe-negation": "error",
        "no-unsafe-optional-chaining": "error",
        "no-unused-labels": "error",
        "no-unused-private-class-members": "error",
        "no-unused-vars": [
          "error",
          {
            "argsIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "caughtErrorsIgnorePattern": "^_"
          }
        ],
        "no-useless-backreference": "error",
        "no-useless-catch": "error",
        "no-useless-escape": "error",
        "no-with": "error",
        "require-yield": "error",
        "use-isnan": "error",
        "valid-typeof": "error",
        "@typescript-eslint/ban-ts-comment": "error",
        "no-array-constructor": "error",
        "@typescript-eslint/no-duplicate-enum-values": "error",
        "@typescript-eslint/no-empty-object-type": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-extra-non-null-assertion": "error",
        "@typescript-eslint/no-misused-new": "error",
        "@typescript-eslint/no-namespace": "error",
        "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
        "@typescript-eslint/no-require-imports": "error",
        "@typescript-eslint/no-this-alias": "error",
        "@typescript-eslint/no-unnecessary-type-constraint": "error",
        "@typescript-eslint/no-unsafe-declaration-merging": "error",
        "@typescript-eslint/no-unsafe-function-type": "error",
        "no-unused-expressions": "error",
        "@typescript-eslint/no-wrapper-object-types": "error",
        "@typescript-eslint/prefer-as-const": "error",
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/triple-slash-reference": "error",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        "react/jsx-key": "warn",
        "react/jsx-no-comment-textnodes": "warn",
        "react/jsx-no-duplicate-props": "warn",
        "react/jsx-no-target-blank": "warn",
        "react/jsx-no-undef": "warn",
        "react/no-children-prop": "warn",
        "react/no-danger-with-children": "warn",
        "react/no-direct-mutation-state": "warn",
        "react/no-find-dom-node": "warn",
        "react/no-is-mounted": "warn",
        "react/no-render-return-value": "warn",
        "react/no-string-refs": "warn",
        "react/no-unescaped-entities": "warn",
        "react/no-unknown-property": "warn",
        "react/react-in-jsx-scope": "off",
        "curly": "off",
        "unicorn/empty-brace-spaces": "off",
        "unicorn/no-nested-ternary": "off",
        "unicorn/number-literal-case": "off"

      }
    },
    {
      "files": [ "*.test.{ts,tsx,js}" ],
      "rules": {
        "all": "off"
      }
    }
  ]
}

</oxlint_reference>
</material>

 <behavior>                                                                                                                   
   Quick fix, do nothing more, directly follow the users request.                                                                     
   </behavior>                                                                                                                        
   <task>                                                                                                                             
   <step>
   <title>Read tsconfig.json</title>
<action>Read @tsconfig.json</action>
    <description>
    Read the tsconfig.json file and focus on the includes and excludes.
    <description>
    </step>
    <step>
    <title>Find the issue with the pattern.</title>
    <action>Find the issue with the pattern.</action>
    <description>
    <excludes>
    THe patter should exclude:
    - node_modules
    - dist
    - *.min.js anywhere 
    - *.bundle.js anywhereof 
    </excludes>
     <includes>
     All js and ts tiles in src/ except if they match any mentioned excludes.
     </includes>
     </description>
     </step>
     <step>
     <title>Fix the patterns.</title>
     <action>Fix the patterns.</action>
     <description>
     Fix the patterns in the tsconfig.json file.
     </description>
     </step>
     <step>
     <title>Output a matching oxlint config .oxlintrc.json</title>
     <action>Output a matching oxlint config .oxlintrc.json at root.</action>
     <description>
     Use the ref oxlint config to create a matching one, only basic rules added , use the oxlint_example as a reference.
     </description>
     </step>
     <step>
      <title>Validate</title>
      <action>Make sure you are complet,and then terminate.</action>
    <if condition="you find a mistake">
    <action>Fix the mistake. THen re-run the step.</action>
    </if>
    </step>
   </task>

   <requirements>
   - Do not modify anything but said files, ie tsconfig, and .oxlintrc.json
   </requirements>

   