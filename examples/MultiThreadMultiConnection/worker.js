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
    const inProgressWork = new Map();
    let AyncProcessingBudget = 1;
    let ConsumerName = "";

    async function main({ redisConnectionString, qName, consumerGroupName, ayncProcessingBudget = 3, checkTimeout = 15000, readFromId = '0', consumerName }) {
        ConsumerName = consumerName;
        AyncProcessingBudget = ayncProcessingBudget;
        const redisClient = new Redis(redisConnectionString);
        const broker = new brokerType(redisClient, qName);
        const consumerGroup = await broker.joinConsumerGroup(consumerGroupName, readFromId);
        const subscriptionHandle = await consumerGroup.subscribe(ConsumerName, newMessageHandler, checkTimeout, ayncProcessingBudget, undefined, true);
        do {
            await Promise.allSettled(inProgressWork.values());
            inProgressWork.clear();
            await new Promise((acc, rej) => setTimeout(acc, checkTimeout * 1));
        }
        while (inProgressWork.size > 0)
        consumerGroup.unsubscribe(subscriptionHandle);
        await redisClient.quit();
        return ConsumerName;
    }

    // Handler for arriving Payload
    async function newMessageHandler(payloads) {
        let nextFetchMessageCount = AyncProcessingBudget;
        let completedPayloadId = null;
        try {
            if (payloads.length <= 0) {
                return AyncProcessingBudget;
            }
            for (let index = 0; index < payloads.length; index++) {
                let payloadWithMeta = payloads[index];
                if (payloadWithMeta.id != null && payloadWithMeta.payload == null) {
                    await payloadWithMeta.markAsRead(false);
                }
                else {
                    inProgressWork.set(payloadWithMeta.id, task(payloadWithMeta));
                }
            }

            do {
                try {
                    if (inProgressWork.size > AyncProcessingBudget) {
                        completedPayloadId = await Promise.race(inProgressWork.values());
                    }
                }
                finally {
                    if (inProgressWork.has(completedPayloadId) === true && completedPayloadId != null) {
                        inProgressWork.delete(completedPayloadId);
                    }
                    nextFetchMessageCount = AyncProcessingBudget - inProgressWork.size;
                }
            }
            while (nextFetchMessageCount <= 0)
            return nextFetchMessageCount;
        }
        catch (err) {
            console.error(err);//TODO Include client error handler here
        }
        finally {
            console.log(`${ConsumerName}:${((inProgressWork.size / AyncProcessingBudget) * 100.0).toFixed(0)}% ${nextFetchMessageCount}`)
        }
    }

    //Provide mark and done functionality and task interface
    async function task(payloadWithMeta) {
        try {
            let taskResult = [true, true];

            //TODO Code Injection here
            await new Promise((acc, rej) => setTimeout(acc, 5000));// Fake delay simulating network or cpu load.

            if (taskResult[0] === true && taskResult[1] === true) {
                payloadWithMeta.markAsRead(true);
            }
            else if (taskResult[0] === true && taskResult[1] === false) {
                payloadWithMeta.markAsRead(false);
            }
        }
        finally {
            return payloadWithMeta.id;
        }
    }

    let config = JSON.parse(workerData);
    main(config)
        .then(r => parentPort.postMessage(r), err => parentPort.postMessage(err))
}