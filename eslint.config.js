// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import storybook from 'eslint-plugin-storybook';
import svelte from 'eslint-plugin-svelte';
import tailwind from 'eslint-plugin-tailwindcss';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
    includeIgnoreFile(gitignorePath),
    // shadcn-svelte primitives are vendored as-is — don't lint generated code.
    { ignores: ['src/lib/components/ui/**'] },
    js.configs.recommended,
    ts.configs.recommended,
    svelte.configs.recommended,
    storybook.configs['flat/recommended'],
    prettier,
    svelte.configs.prettier,
    {
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: {
            // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
            // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
            'no-undef': 'off',
            // Allow `_`-prefixed identifiers to signal an intentionally unused
            // binding (e.g. required-but-unused transition args, reserved state).
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ]
        }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: ['.svelte'],
                parser: ts.parser,
                svelteConfig
            }
        }
    },
    // Validate Tailwind class strings in Svelte markup. Uses the v4-compatible
    // plugin (Tailwind v4 is CSS-first — no tailwind.config.js), so config is
    // read from the CSS entry via `cssConfigPath`.
    {
        files: ['**/*.svelte'],
        plugins: { tailwindcss: tailwind },
        rules: {
            ...tailwind.configs.recommended.rules,
            // prettier-plugin-tailwindcss already sorts classes (different
            // algorithm) — leave ordering to it to avoid conflicting fixes.
            'tailwindcss/classnames-order': 'off'
        },
        settings: {
            tailwindcss: {
                cssConfigPath: './src/routes/layout.css'
            }
        }
    },
    {
        // Override or add rule settings here, such as:
        // 'svelte/button-has-type': 'error'
        rules: {}
    }
);
