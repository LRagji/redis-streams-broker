const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
    const redisConnectionString = "redis://127.0.0.1:6379/";
    const qName = "hsio";
    let workersPromises = [];
    const workers = new Map();
    for (let threadCounter = 0; threadCounter < 1; threadCounter++) {
        let workerP = new Promise((resolve, reject) => {
            const groupName = "CG1";
            const consumer = groupName + (Math.random() * 100).toFixed(0);
            const worker = new Worker(__filename, {
                workerData: JSON.stringify({
                    "redisConnectionString": redisConnectionString,
                    "qName": qName,
                    "consumerGroupName": groupName,
                    "ayncProcessingBudget": 100,
                    "checkTimeout": 15000,
                    "readFromId": '0',
                    "consumerName": consumer
                })
            });
            worker.on('message', resolve);
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0)
                    reject(new Error(`Worker stopped with exit code ${code}`));
            });
            workers.set(consumer, worker);
        });
        workersPromises.push((async () => {
            let workerName = await workerP;
            if (workers.has(workerName)) {
                workers.delete(workerName);
            }
            return workerName;
        })());
    }

    console.log(`Waiting for Workers(${workersPromises.length}) to complete..`)
    let diagnostic = async () => {
        while (workers.size > 0) {
            workers.forEach((w, name) => {
                let instrumentation = w.performance.eventLoopUtilization();
                console.log(`${name}: ${(instrumentation.active / (instrumentation.idle + instrumentation.active) * 100.0).toFixed(2)}% ${instrumentation.utilization.toFixed(2)}% `);
            });
            await new Promise((acc, rej) => setTimeout(acc, 1000));
        }
        return "Diagnostic Completed";
    };
    //workersPromises.push(diagnostic());
    Promise.allSettled(workersPromises)
        .then((r) => {
            console.table(r);
            workers.clear();
            workersPromises = [];
            console.log("Completed");
        })
        .catch(console.error);
}
else {

    const Redis = require("ioredis");
    const brokerType = require('../../index').StreamChannelBroker;
    const AsyncProcessor = require('../../index').AsyncProcessor;
    let AyncProcessingBudget = 1;
    let ConsumerName = "";

    async function main({ redisConnectionString, qName, consumerGroupName, ayncProcessingBudget = 3, checkTimeout = 15000, readFromId = '0', consumerName }) {
        ConsumerName = consumerName;
        AyncProcessingBudget = ayncProcessingBudget;
        const redisClient = new Redis(redisConnectionString);
        const processor = new AsyncProcessor(task, AyncProcessingBudget);
        const broker = new brokerType(redisClient, qName);
        const consumerGroup = await broker.joinConsumerGroup(consumerGroupName, readFromId);
        const subscriptionHandle = await consumerGroup.subscribe(ConsumerName, processor.streamHandler, checkTimeout, ayncProcessingBudget, undefined, true);
        do {
            await processor.waitForAllCompletion()
            await new Promise((acc, rej) => setTimeout(acc, checkTimeout * 1));
        }
        while (processor.activeItems() > 0)
        consumerGroup.unsubscribe(subscriptionHandle);
        await redisClient.quit();
        return ConsumerName;
    }

    async function task(channel,id, payload) {
        console.log(`${channel} --> ${id}:${JSON.stringify(payload)}`)
        await new Promise((acc, rej) => setTimeout(acc, 5000));// Fake delay simulating network or cpu load.
        return [true, true];
    }

    let config = JSON.parse(workerData);
    main(config)
        .then(r => parentPort.postMessage(r), err => parentPort.postMessage(err))
}