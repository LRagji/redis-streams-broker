// let shortIdGenerator = require('shortid');
// const assert = require('assert');
// const consoleProgressBarType = require('node-progress-bars');
module.exports = class Utils {

    static async KillTime(millis) {
        return new Promise((res, rej) => {
            setTimeout(res, millis);
        });
    }
}