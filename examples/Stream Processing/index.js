//This example demonstrates using any npm package for connecting to redis as client and inject it into the broker. 

const redis = require("redis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "Queue";
const myFavClient = redis.createClient(redisConnectionString);
const { promisify } = require("util");

const redisInjectableClient = {};
redisInjectableClient.xreadgroup = promisify(myFavClient.xreadgroup).bind(myFavClient);
redisInjectableClient.xack = promisify(myFavClient.xack).bind(myFavClient);
redisInjectableClient.multi = () => {
    let multiObject = myFavClient.multi();
    multiObject.exec = promisify(multiObject.exec);
    return multiObject;
};
redisInjectableClient.xdel = promisify(myFavClient.xdel).bind(myFavClient);
redisInjectableClient.xpending = promisify(myFavClient.xpending).bind(myFavClient);
redisInjectableClient.xgroup = promisify(myFavClient.xgroup).bind(myFavClient);
redisInjectableClient.memory = promisify(myFavClient.memory).bind(myFavClient);
redisInjectableClient.xadd = promisify(myFavClient.xadd).bind(myFavClient);

const brokerType = require('../../index').StreamChannelBroker;
const totalAsyncBandwidth = 3;

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

showcase = async () => {

    const broker = new brokerType(redisInjectableClient, qName);

    //Used to publish a paylod on stream.
    for (let i = 0; i < (totalAsyncBandwidth * 2); i++) {
        await broker.publish({ a: "Hello", b: "World", t: Date.now().toString() });
    }
    //Start Publishing on timer
    const publisherHandle = setInterval(() => broker.publish({ a: "Hello", b: "World", t: Date.now().toString() }), 1000);

    //Creates a consumer group to receive payload
    const consumerGroup = await broker.joinConsumerGroup("MyGroup", '0');
    console.log(`Created group with name: ${consumerGroup.name}`);

    //Registers a new consumer with Name and Callback for message handlling.

    const subscriptionHandle = await consumerGroup.subscribe("Consumer1", newMessageHandler, undefined, totalAsyncBandwidth);
    console.log(`Created consumer in group and subscribed with handle id: ${subscriptionHandle}`);


    //Global Cache of work in progress items.
    const workInProgressItems = new Map();

    //Data Processor
    async function dataProcessor(payloadWithMeta) {
        try {
            // console.log("\n");
            // console.log("Payload Id:", payloadWithMeta.id); //Payload Id
            // console.log("Payload Received from :", payloadWithMeta.channel); //Stream name
            // console.log("Actual Payload:", payloadWithMeta.payload); //Actual Payload

            await new Promise((acc, rej) => setTimeout(acc, getRandomInt(5000, 15000)));//Network call or some async work simulation.

            const ack = await payloadWithMeta.markAsRead(true); //Payload is marked as delivered or Acked also optionaly the message can be dropped.
            // console.log("Payload acked : " + ack);
            // console.log("\n");
        }
        catch (exception) {
            console.error(exception);
        }
        finally {
            return payloadWithMeta.id;
        }
    }

    //Executor
    async function executor(payloadWithMeta) {
        let payloadId = await dataProcessor(payloadWithMeta);
        if (workInProgressItems.has(payloadId)) {
            workInProgressItems.delete(payloadId);
            console.log("Active work in progress:" + workInProgressItems.size);
        } else {
            console.error("This should never occur we have Promise missing from executor for id:" + payloadId);
        }
    }

    // Handler for arriving Payload
    async function newMessageHandler(payloads) {
        for (let index = 0; index < payloads.length; index++) {
            workInProgressItems.set(payloads[index].id, executor(payloads[index]));
        }
        console.log("Qued: " + payloads.length);

        let requestItems = -1;
        do {
            await Promise.race(workInProgressItems.values());
            requestItems = totalAsyncBandwidth - workInProgressItems.size;
            console.log("Bandwidth open for:" + requestItems);
        }
        while (requestItems <= 0)
        return requestItems;
    }

    console.log("Waiting for receving messages from stream.");
    do {
        //Waiting for all work to finish
        await Promise.allSettled(workInProgressItems.values());
        //Deadband of 5 Sec to wait for any new incomming messages.
        await new Promise((acc, rej) => setTimeout(acc, 5000));
    }
    while (workInProgressItems.size > 0)

    //Stop Publishing
    clearInterval(publisherHandle);

    //Provides summary of payloads which have delivered but not acked yet.
    const summary = await consumerGroup.pendingSummary();
    console.log(`Pending messages: ${summary.total}`);

    //Unsubscribes the consumer from the group.
    const sucess = consumerGroup.unsubscribe(subscriptionHandle);
    console.log(`Unsubscribed: ${sucess}`);

    //Amount of memory consumed by this stream in bytes.
    const consumedMem = await broker.memoryFootprint();
    console.log(`Total memory: ${consumedMem}Bytes`);

};

showcase()
    .then((e) => {
        console.log("Demonstration successful.");
        myFavClient.quit();
    })
    .catch(console.error);