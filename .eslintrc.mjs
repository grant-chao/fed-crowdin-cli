export default {
    root: true,
    env: {
        es6: true,
        browser: true,
        node: true
    },
    parser: '@babel/eslint-parser',
    parserOptions: {
        sourceType: "module",
        babelOptions: {
            plugins: [
                '@babel/plugin-syntax-import-assertions'
            ],
        },
    },
    extends: [],
    plugins: [],
    rules: {
        'indent': [
            'error',
            4,
            {
                "SwitchCase": 1,
                "ignoredNodes": ["TemplateLiteral"]
            }
        ],
        'import/no-unresolved': 'off',
        'no-param-reassign': 'off',
        'consistent-return': 'off',
        'global-require': 'off',
        'semi': ['error', 'always'],
        "no-multiple-empty-lines": [1, {"max": 1}],
        'no-empty': 'warn',
        'comma-dangle': ['error', 'only-multiline'],
        "max-len": ["error", { "code": 350 }],
    }
};
