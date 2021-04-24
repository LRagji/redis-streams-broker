//This example demonstrates using any npm package for connecting to redis as client and inject it into the broker. 

const redis = require("redis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "Queue";
const myFavClient = redis.createClient(redisConnectionString);
const { promisify } = require("util");

const redisInjectableClient = {};
redisInjectableClient.xreadgroup = promisify(myFavClient.xreadgroup).bind(myFavClient);
redisInjectableClient.xack = promisify(myFavClient.xack).bind(myFavClient);
redisInjectableClient.multi = promisify(myFavClient.multi).bind(myFavClient);
redisInjectableClient.xdel = promisify(myFavClient.xdel).bind(myFavClient);
redisInjectableClient.xpending = promisify(myFavClient.xpending).bind(myFavClient);
redisInjectableClient.xgroup = promisify(myFavClient.xgroup).bind(myFavClient);
redisInjectableClient.memory = promisify(myFavClient.memory).bind(myFavClient);
redisInjectableClient.xadd = promisify(myFavClient.xadd).bind(myFavClient);

const brokerType = require('../index').StreamChannelBroker;

showcase = async () => {

    const broker = new brokerType(redisInjectableClient, qName);

    //Used to publish a paylod on stream.
    const payloadId = await broker.publish({ a: "Hello", b: "World" });
    console.log(`Pushed message into stream with id: ${payloadId}`);


    //Creates a consumer group to receive payload
    const consumerGroup = await broker.joinConsumerGroup("MyGroup", '0');
    console.log(`Created group with name: ${consumerGroup.name}`);

    //Registers a new consumer with Name and Callback for message handlling.
    const subscriptionHandle = await consumerGroup.subscribe("Consumer1", newMessageHandler);
    console.log(`Created consumer in group and subscribed with handle id: ${subscriptionHandle}`);


    // Handler for arriving Payload
    async function newMessageHandler(payload) {
        for (let index = 0; index < payload.length; index++) {
            try {
                const element = payload[index];
                console.log("\n");
                console.log("Payload Id:", element.id); //Payload Id
                console.log("Payload Received from :", element.channel); //Stream name
                console.log("Actual Payload:", element.payload); //Actual Payload
                const ack = await element.markAsRead(); //Payload is marked as delivered or Acked also optionaly the message can be dropped.
                console.log("Payload acked : " + ack);
                console.log("\n");
            }
            catch (exception) {
                console.error(exception);
            }
        }
    }

    console.log("Waiting for receving messages from stream.");
    await new Promise((acc, rej) => setTimeout(acc, 5000));

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