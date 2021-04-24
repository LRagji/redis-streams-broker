//This is a slow consumer which takes 5 seconds to process one packet
//It simply adds LHS & RHS and compare with the result after 5 seconds simulating heavy load or network activity.


const Redis = require("ioredis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "hsio";
const redisClient = new Redis(redisConnectionString);
const brokerType = require('redis-streams-broker').StreamChannelBroker;
const broker = new brokerType(redisClient, qName);


// Handler for arriving Payload
async function newMessageHandler(payloads) {
    for (let index = 0; index < payloads.length; index++) {
        try {
            const element = payloads[index];
            if ((parseInt(element.payload.lhs) + parseInt(element.payload.rhs)) === parseInt(element.payload.result)) {

                await new Promise((acc, rej) => setTimeout(acc, 5000));// Fake delay simulating network or cpu load.

                await element.markAsRead(true);
                console.log("Payload Id:", element.id);
            }
            else {
                console.log("Payload Id:", element.id + " failed math exam!!!");
            }
        }
        catch (exception) {
            console.error(exception);
        }
    }
}

//Creates a consumer group to receive payload
broker.joinConsumerGroup("MyGroup", 0)
    .then(consumerGroup => consumerGroup.subscribe("Consumer1", newMessageHandler, 500, 1, "SlowConsumer", true))
    .then(console.log)
    .catch(console.error);

