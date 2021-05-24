const Piscina = require('piscina');
const path = require('path');
//const Redis = require("ioredis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "hsio";
//const redisClient = new Redis(redisConnectionString);
//const brokerType = require('../../index').StreamChannelBroker;
//const broker = new brokerType(redisClient, qName);
const threadPool = new Piscina({
    filename: path.resolve(__dirname, 'worker.js'),
    maxThreads: 3,
    minThreads: 1
});

threadPool.run({
    "redisConnectionString": redisConnectionString,
    "qName": qName,
    "consumerGroupName": "CG1",
    "ayncProcessingBudget": 3,
    "checkTimeout": 15000,
    "readFromId": '0'
})
    .then((result) => {
        console.table(result);
        console.log("All Threads shotdown")
    })
    .catch(console.error);