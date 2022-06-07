const nodegit = require('nodegit');
const path = require("path");
const utils = require('./index');
const config = require('../config');

module.exports = {
    getRepository() {
        return new Promise((resolve) => {
            nodegit.Repository.open(path.resolve(process.cwd(), ".git")).then((repo) => {
                resolve(repo);
            });
        });
    },
    getDiff() {
        return new Promise((resolve, reject) => {
            this.getRepository().then((repo) => {
                repo.getCurrentBranch().then((ref) => {
                    let branchName = ref.name().replace('refs/heads/', '');
                    const isMaster = branchName === 'main' || branchName === 'master';
                    console.log(isMaster);
                    repo.getBranchCommit(branchName).then(function(commit) {
                        commit.getDiff().then((list) => {
                            console.log(list);
                        });
                    });
                });
            });
        });
    }
};
