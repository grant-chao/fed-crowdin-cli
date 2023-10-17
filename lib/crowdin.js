import config from './config.js';
import path from 'path';
import utils from './utils/index.js';
import crowdin from '@crowdin/crowdin-api-client';
import fs from 'fs';
import compressing from 'compressing';
import axios from 'axios';
import Module from "node:module";
const require = Module.createRequire(import.meta.url);

class Crowdin {
    constructor() {
        this.config = config;
        if (config.keys) {
            const keysPath = path.resolve(process.cwd(), config.keys);
            !utils.exists(keysPath) && utils.mkdir(keysPath);
        }
        if (config.output) {
            const outputPath = path.resolve(process.cwd(), config.output);
            !utils.exists(outputPath) && utils.mkdir(outputPath);
        }
        utils.exists(config.home) && utils.rmdir(config.home);
        utils.mkdirs(config.home);
        utils.mkdir(config.home + '/download');
        utils.mkdir(config.home + '/source');
        utils.mkdir(config.home + '/result');
        this.crowdin = new crowdin.default({ token: config.token });
    }

    _checkBuildStatus(projectId, buildId) {
        const { crowdin } = this;
        const { translationsApi } = crowdin;
        let timer = null;
        return new Promise((resolve, reject) => {
            timer = setInterval(()=>{
                translationsApi.checkBuildStatus(projectId, buildId).then((result)=>{
                    if(result.data.status === "finished") {
                        clearInterval(timer);
                        resolve();
                    }
                }).catch(() => {
                    clearInterval(timer);
                    reject();
                });
            }, 1000);
        });
    }

    _downloadTranslations(projectId) {
        const { crowdin, config } = this;
        const { translationsApi } = crowdin;
        return new Promise((resolve, reject) => {
            translationsApi.buildProject(projectId).then((result) => {
                const buildId = result.data.id;
                this._checkBuildStatus(projectId, buildId).then(() => {
                    translationsApi.downloadTranslations(projectId, buildId).then((result) => {
                        axios.get(result.data.url,{
                            responseType:'stream',
                        }).then((result) => {
                            const zipPath = `${config.home}/download/all.zip`;
                            const resultPath = `${config.home}/result`;
                            const sourcePath = `${config.home}/source`;
                            const writer = fs.createWriteStream(zipPath);
                            result.data.pipe(writer);
                            writer.on("finish", () => {
                                compressing.zip.uncompress(zipPath, resultPath)
                                    .then(() => {
                                        utils.copy(`${resultPath}/${config.sourceLanguage}`, sourcePath);
                                        resolve();
                                    })
                                    .catch(reject);
                            });
                            writer.on("error", reject);
                        }).catch(reject);
                    }).catch(reject);
                }).catch(reject);
            }).catch(reject);
        });
    }

    syncKeys() {
        const { config } = this;
        const { home } = config;
        const sourcePath = `${home}/source`;
        const files = utils.readDirSync(sourcePath);
        files.forEach((file) => {
            const names = file.split('/');
            const name = names[names.length - 1];
            const json = require(file);
            let keys = [];
            Object.keys(json).forEach((key) => {
                keys.push(json[key]);
            });
            const keyPath = path.resolve(process.cwd(), `${config.keys}/${name}`);
            utils.writeJSON(keyPath, keys);
        });
    }

    async push() {
        const { config } = this;
        const { fileName } = config;
        const { projectId } = config;
        // 下载词条
        await this._downloadTranslations(projectId);
        this.syncKeys();

        const root = path.resolve(process.cwd(), '');
        const keysPath = path.resolve(process.cwd(), config.keys);
        const files = [];
        config.paths.forEach((d) => {
            const dir = path.resolve(root, `${d}`);
            if(!utils.exists(dir)) return;
            const pathFiles = utils.readDirSync(dir, config.fileTypes);
            files.push(...pathFiles);
        });
        const words = []; // 文件中的词条
        const oldWords = []; // 以前提上去的词条
        const newWords = []; //  新的词条
        const delWords = []; // 需要删除的词条
        const specials = [];

        // 工程中所有的词条
        files.forEach((file) => {
            const data = fs.readFileSync(file);
            data.toString().replace(/{#(.*?)#}:for\((.*?)\)/g, (_, $1, $2) => {
                specials.push(`${$1}:${$2}`);
                return $1;
            }).replace(/{#(.*?)#}/g, ($,$1) => {
                if(['(.+?)','(.*?)'].includes($1) || config.variables.includes($1) || words.includes($1)) return;
                words.push($1);
            });
        });


        // 之前提交的提条
        const keyFiles = utils.readDirSync(keysPath);
        keyFiles.forEach((file) => {
            if(file.endsWith("special.json")) return;
            const data = fs.readFileSync(file);
            const ws = JSON.parse(data.toString());
            oldWords.push(...ws);
        });

        // 本地新增的词条
        words.forEach((word) => {
            if(!oldWords.includes(word))
                newWords.push(word);
        });

        // 需要删除的词条
        oldWords.forEach((word) => {
            if(!words.includes(word))
                delWords.push(word);
        });

        this._pushFile({
            fileName,
            delWords,
            newWords
        });

        // 处理带场景的词条
        const newSpecials = []; //  新的词条
        const delSpecials = []; // 需要删除的词条
        const specialData = fs.readFileSync(`${keysPath}/special.json`);
        const oldSpecials = JSON.parse(specialData.toString());
        // 本地新增的词条
        specials.forEach((word) => {
            if(!oldSpecials.includes(word))
                newSpecials.push(word);
        });
        // 需要删除的词条
        oldSpecials.forEach((word) => {
            if(!specials.includes(word))
                delSpecials.push(word);
        });

        this._pushFile({
            fileName: 'special.json',
            delWords: delSpecials,
            newWords: newSpecials
        })
    }
    _pushFile(pushConfig) {
        const {
            fileName,
            delWords,
            newWords
        } = pushConfig;
        const { config, crowdin } = this;
        const { projectId } = config;
        const { uploadStorageApi, sourceFilesApi } = crowdin;
        const sourcePath = `${config.home}/source`;

        // 当前词条文件需要删除的
        const currentDelKeys = [];
        const keyPath = path.resolve(process.cwd(), config.keys + "/" + fileName);
        let keys = [];
        if(utils.exists(keyPath)) {
            keys = require(keyPath);
        }
        delWords.forEach((word) => {
            if(keys.includes(word))
                currentDelKeys.push(word);
        });

        const oldSourceFile = sourcePath + '/' + fileName;
        let oldJson = {};
        if(utils.exists(oldSourceFile)) oldJson = require(oldSourceFile);
        const newAllKey = [];
        const newJson = {};
        keys.forEach((key) => {
            if(!currentDelKeys.includes(key))
                newAllKey.push(key);
        });
        newAllKey.push(...newWords);

        // 删除需要删除的词条
        Object.keys(oldJson).forEach((k) => {
            const v = oldJson[k];
            if(currentDelKeys.includes(v)) return;
            newJson[k] = v;
        });
        // 需要添加的词条
        newWords.forEach((word) => {
            newJson[utils.randomString(8)] = word;
        });

        // 写入工程
        utils.writeJSON(keyPath, newAllKey);
        // 写入缓存
        utils.writeJSON(oldSourceFile, newJson);

        // 上传文件
        uploadStorageApi.addStorage(fileName, fs.readFileSync(oldSourceFile)).then((result) => {
            const storageId = result.data.id;
            sourceFilesApi.listProjectFiles(projectId).then((result) => {
                const names = result.data.map((file) => { return file.data;});
                const fileObject = names.find(({name}) => (name === fileName));
                if(fileObject) { // 已有
                    sourceFilesApi.updateOrRestoreFile(projectId, fileObject.id, {
                        storageId
                    }).then();
                }else{
                    sourceFilesApi.createFile(projectId, {
                        storageId,
                        name: fileName
                    }).then();
                }
            });
        });
    }
    pull(){
        const { config } = this;
        const { projectId } = config;
        this._downloadTranslations(projectId).then(() => {
            this.syncKeys();
            this.i18n();
        });
    }
    // 重新生成国际化
    i18n() {
        const { config } = this;
        const { languageMap } = config;
        const outputPath = path.resolve(process.cwd(), config.output);

        const sourcePath = `${config.home}/source`;
        const sources = utils.readDirSync(sourcePath);
        let sourceObject = {};
        sources.forEach((file) => {
            if(file.endsWith("special.json")) return;
            const json = require(file);
            sourceObject = Object.assign(sourceObject, json);
        });

        Object.keys(languageMap).forEach((key) => {
            const langVar = languageMap[key];
            const { crowdin, LANG } = langVar;
            const filePath = `${outputPath}/${LANG}.json`;
            // console.log(filePath);
            const resultFile = `${config.home}/result/${crowdin}`;
            const files = utils.readDirSync(resultFile);
            let resultObject = {};
            files.forEach((file) => {
                if(file.endsWith("special.json")) return;
                const json = require(file);
                resultObject = Object.assign(resultObject, json);
            });
            // 准备语言文件
            const resultData = {};
            Object.keys(sourceObject).forEach((objectKey) => {
                const key = sourceObject[objectKey];
                let v = resultObject[objectKey] || key;
                v = v.replace(/\n/g,'').replace(/"/g, '\\\"').replace(/'/g, '\\\'');
                resultData[key] = v;
            });
            const fileData = {};
            fileData[LANG] = resultData;

            // 写入工程
            utils.writeJSON(filePath, fileData);
        });

        // special
        const keysPath = path.resolve(process.cwd(), config.keys);
        const specialData = fs.readFileSync(`${keysPath}/special.json`);
        const allSpecials = JSON.parse(specialData.toString());
        const specialFile = path.resolve(sourcePath, "special.json");
        const specialJson = require(specialFile);
        const fileData = {};
        Object.keys(languageMap).forEach((key) => {
            const langVar = languageMap[key];
            const { crowdin, LANG } = langVar;
            const resultFile = `${config.home}/result/${crowdin}/special.json`;
            const resultObject = require(resultFile);
            // 准备语言文件
            const resultData = {};
            Object.keys(specialJson).forEach((objectKey) => {
                const key = specialJson[objectKey];
                let v = resultObject[objectKey] || key;
                if(allSpecials.includes(v)) {
                    const last = v.lastIndexOf(":");
                    v = v.substring(0, last);
                }
                v = v.replace(/\n/g,'').replace(/"/g, '\\\"').replace(/'/g, '\\\'');
                resultData[key] = v;
            });
            fileData[LANG] = resultData;
        });
        // 写入工程
        utils.writeJSON(`${outputPath}/special.json`, fileData);
    }
}

export default Crowdin;
