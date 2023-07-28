import path from 'path';
import utils from './utils/index.js';
import Module from "node:module";
const require = Module.createRequire(import.meta.url);

const USER_HOME = process.env.HOME || process.env.USERPROFILE;

const config = {
    keys: "",
    project: "",
    projectId: "",
    token: "",
    output: "",
    prefix: "keys",
    fileTypes: [".ejs", ".html",'.vue','.js'],
    paths: [],
    sourceLanguage: 'zh-CN',
    variables: ['LANG', 'ROOT'],

    apiBase: 'https://api.crowdin.com/api/project'
};

// 检测自定义配置文件是否存在
const rc = path.resolve(process.cwd(), "./.crowdinrc.cjs");
utils.exists(rc) && Object.assign(config, require(rc) || {});

config.home = USER_HOME + '/.fed-crowdin-cli-v2/' + config.project;

export default config;
