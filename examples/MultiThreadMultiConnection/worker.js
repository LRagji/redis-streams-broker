const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
    const redisConnectionString = "redis://127.0.0.1:6379/";
    const qName = "hsio";
    for (let threadCounter = 0; threadCounter < 2; threadCounter++) {
        let thread = new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    "redisConnectionString": redisConnectionString,
                    "qName": qName,
                    "consumerGroupName": "CG1",
                    "ayncProcessingBudget": 3,
                    "checkTimeout": 15000,
                    "readFromId": '0'
                }
            });
            worker.on('message', resolve);
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0)
                    reject(new Error(`Worker stopped with exit code ${code}`));
            });
        });
    }
}
else {

    const Redis = require("ioredis");
    const brokerType = require('../../index').StreamChannelBroker;
    const inProgressWork = new Map();
    let AyncProcessingBudget = 1;
    let ConsumerName = "";

    async function main({ redisConnectionString, qName, consumerGroupName, ayncProcessingBudget = 3, checkTimeout = 15000, readFromId = '0' }) {
        ConsumerName = consumerGroupName + (Math.random() * 100).toFixed(0);
        AyncProcessingBudget = ayncProcessingBudget;
        const redisClient = new Redis(redisConnectionString);
        const broker = new brokerType(redisClient, qName);
        const consumerGroup = await broker.joinConsumerGroup(consumerGroupName, readFromId);
        const subscriptionHandle = await consumerGroup.subscribe(ConsumerName, newMessageHandler, checkTimeout, ayncProcessingBudget);
        do {
            await Promise.allSettled(inProgressWork.values());
            inProgressWork.clear();
            await new Promise((acc, rej) => setTimeout(acc, checkTimeout * 3));
        }
        while (inProgressWork.size > 0)
        consumerGroup.unsubscribe(subscriptionHandle);
        await redisClient.quit()
        return ConsumerName;
    }

    // Handler for arriving Payload
    async function newMessageHandler(payloads) {
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

            let nextFetchMessageCount = -1;
            let completedPayloadId = null;
            do {
                try {
                    if (inProgressWork.size > 0) {
                        completedPayloadId = await Promise.race(inProgressWork.values());
                    }
                }
                finally {
                    if (inProgressWork.has(completedPayloadId) === true) {
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
            console.log(`${ConsumerName}:${inProgressWork.size}`)
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
        .then(parentPort.postMessage, parentPort.postMessage)

}