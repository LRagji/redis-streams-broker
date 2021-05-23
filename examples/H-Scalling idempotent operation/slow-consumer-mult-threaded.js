//This is a slow consumer which takes 5 seconds to process one packet
//It simply adds LHS & RHS and compare with the result after 5 seconds simulating heavy load or network activity.
//This consumer demonstrates how multi threading can be done to achive Horizontal Scalling.

const Piscina = require('piscina');
const path = require('path');
const Redis = require("ioredis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "hsio";
const redisClient = new Redis(redisConnectionString);
const brokerType = require('../../index').StreamChannelBroker;
const broker = new brokerType(redisClient, qName);
const totalAsyncBandwidth = 10;
const threadPool = new Piscina({
    filename: path.resolve(__dirname, 'payload-processing.js'),
    maxThreads: totalAsyncBandwidth > 0 ? totalAsyncBandwidth : 1,
    minThreads: 1
});
const inProgressItems = new Map();


//Thread Pool Executor
async function postExecutionOnThreadPool(payloadWithMeta) {
    try {
        let threadResponse = await threadPool.runTask(payloadWithMeta.payload);
        if (threadResponse === true) {
            if (await payloadWithMeta.markAsRead(true) !== true) {
                throw new Error(`Failed to ack message id ${payloadWithMeta.id}, payload will be re-processed.`);
            }
        }
        else {
            throw new Error(`Unknown response ${threadResponse} item is not acked.`);
        }
    }
    finally {
        return payloadWithMeta.id;
    }
}

//Deleted Message but still in pending list handler
async function handleDroppedMessage(payloadWithMeta) {
    try {
        //Invoke message missing callback
        console.log(`${payloadWithMeta.id} is missing!.`);
        //You cannot delete it cause its already deleted.
        await payloadWithMeta.markAsRead();
    }
    finally {

        return payloadWithMeta.id;
    }
}

// Handler for arriving Payload
async function newMessageHandler(payloads) {
    if (payloads.length <= 0) return totalAsyncBandwidth;
    let completedPayloadId = null;
    try {
        //Post for execution
        payloads.forEach(payloadWithMeta => {
            if (payloadWithMeta.id != null && payloadWithMeta.payload == null) {
                //This means a message is dropped from redis stream due to it being capped but is on pending list of consumer.
                inProgressItems.set(payloadWithMeta.id, handleDroppedMessage(payloadWithMeta));
            }
            else {
                inProgressItems.set(payloadWithMeta.id, postExecutionOnThreadPool(payloadWithMeta));
            }
        });

        //Await for atleast one to complete
        if (inProgressItems.size > 0) {
            do {
                try {
                    completedPayloadId = await Promise.race(inProgressItems.values());
                }
                finally {
                    if (inProgressItems.has(completedPayloadId) === true) {
                        inProgressItems.delete(completedPayloadId);
                    }
                    console.log(`${completedPayloadId} Threads:${threadPool.threads.length}/${threadPool.options.maxThreads} Pending:${inProgressItems.size} QTime(p97.5): ${threadPool.waitTime.p97_5}ms`);
                }
            }
            while (inProgressItems.size >= totalAsyncBandwidth) //This is so that we donot get any into situation where more work item is qued up than we aimed for
        }
    }
    catch (exception) {
        console.error(exception);
    }
    finally {
        const totalItems = inProgressItems.size;
        const itemsCompleted = totalAsyncBandwidth - totalItems;
        if (itemsCompleted <= 0) {
            console.error("Its calling unsubscribe");
        }
        return itemsCompleted
    }
}



(async () => {

    //Creates a consumer group to receive payload
    const consumerGroup = await broker.joinConsumerGroup("MyGroup", 0);

    //Registers a new consumer with Name and Callback for message handlling.
    const subscriptionHandle = await consumerGroup.subscribe("Consumer1", newMessageHandler, 5000, totalAsyncBandwidth, "SlowConsumer", true);
    console.log("Subscribed to stream with handle:" + subscriptionHandle);

    //Processing Data (If no data is present in the stream for 5 consecutive seconds then it will unsbscribe)
    console.log("Draining all messages from stream.");
    do {
        //Waiting for all work to finish
        if (inProgressItems.size > 0) {
            await Promise.allSettled(inProgressItems.values());
            inProgressItems.clear();
        }
        //Deadband of 5 Sec to wait for any new incomming messages.
        await new Promise((acc, rej) => setTimeout(acc, 5000));
    }
    while (inProgressItems.size > 0)

    //Provides summary of payloads which have delivered but not acked yet.
    const summary = await consumerGroup.pendingSummary();
    console.log(`Pending messages: ${summary.total}`);

    //Unsubscribes the consumer from the group.
    const sucess = consumerGroup.unsubscribe(subscriptionHandle);
    console.log(`Unsubscribed: ${sucess}`);

    //Amount of memory consumed by this stream in bytes.
    const consumedMem = await broker.memoryFootprint();
    console.log(`Total memory: ${consumedMem}Bytes`);

})()
    .then(() => {
        console.log("Demonstration successful.");
        redisClient.quit();
    })
    .catch(console.error);
