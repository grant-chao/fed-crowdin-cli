# fed-crowdin-cli

配置文件

```js
// 项目根目录下创建 .crowdinrc.cjs
const pkg = require('./package.json');

module.exports = {
    keys: "./packages/i18n/langkeys",
    projectId: "1",
    project: "project-id",
    token: "", // 在 crowdin 获取 token
    output: "./packages/i18n/lang",
    fileName: `keys_${pkg.version}.json`,
    paths: ["./packages/"], // 读取那些文件
    fileTypes: [".ts", ".js",'.tsx','.jsx'], // 文件类型
    sourceLanguage: 'zh-CN', // 源语言
    languageMap: { // 语言映射
        "en-us": {
            "crowdin": "en",
            "LANG": "en-us",
            "LANG_CODE": "en",
            "LANG_AREA": "us",
            "ROOT": "/en-us/"
        },
        "zh-cn": {
            "crowdin": "zh-CN",
            "LANG": "zh-cn",
            "LANG_CODE": "zh",
            "LANG_AREA": "cn",
            "ROOT": "/zh-cn/"
        },
        "zh-tw": {
            "crowdin": "zh-TW",
            "LANG": "zh-tw",
            "LANG_CODE": "zh",
            "LANG_AREA": "tw",
            "ROOT": "/zh-tw/"
        }
    },
    variables: ['LANG'], // 变量
};

```
