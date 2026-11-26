import js from '@eslint/js';
import globals from 'globals';
import lit from 'eslint-plugin-lit';
import wc from 'eslint-plugin-wc';

const browser = ['src/**/*.js', 'demo/**/*.js'];

export default [
    { ignores: ['dist/', 'node_modules/', 'tmp/', '.parcel-cache/', '_site/', 'src/vendor/', 'src/d3_mollierhx/'] },
    js.configs.recommended,
    { ...lit.configs['flat/recommended'], files: browser },
    { ...wc.configs['flat/recommended'], files: browser },
    { files: browser, languageOptions: { globals: globals.browser } },
    { files: ['scripts/**/*.mjs', 'test/**/*.js', '*.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
    { rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
];
