const exec = require('child_process').exec;

module.exports = {
    getBrandName: () => {
        return new Promise((resolve, reject) => {
            exec('git symbolic-ref --short -q HEAD', function(error, stdout, stderr){
                if(error) {
                    reject(error);
                }else{
                    resolve(stdout.split('\n')[0]);
                }
            });
        });
    }
};
