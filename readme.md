# redis-streams-broker

This package is based on [redis stream](https://github.com/LRagji/redis-streams-broker) data type which provides you with following features 
1. Broker to redis stream which can be used as centralized que between microservices. (Using Redis)
2. Support for injectable redis client (be it [ioredis](https://www.npmjs.com/package/ioredis) or [redis](https://www.npmjs.com/package/redis))
3. Guarantee of message delivery via consumer acknowledgements.
4. Consumer Group functionality for scalability. (Just like Kafka)
5. Option to drop a message when its acked, thus keeping memory footprint in check.

## Getting Started

1. Install using `npm -i redis-streams-broker`
2. Require in your project. `const brokerType = require('redis-streams-broker').StreamChannelBroker;`
3. Run redis on local docker if required. `docker run --name streamz -p 6379:6379 -itd --rm redis:latest`
3. Instantiate with a redis client and name for the stream. `const broker = new brokerType(redisClient, name);`
4. All done, Start using it!!.

## Examples/Code snippets

1. Please find example code for injectable ioredis client [here](https://github.com/LRagji/redis-streams-broker/blob/master/examples/ioredis.js)
2. Please find example code for injectable custom client [here](https://github.com/LRagji/redis-streams-broker/blob/master/examples/custom.js)

```javascript
const Redis = require("ioredis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "Queue";
const redisClient = new Redis(redisConnectionString);
const brokerType = require('../index').StreamChannelBroker;

//Used to publish a paylod on stream.
const payloadId = await broker.publish({ a: "Hello", b: "World" }); 

//Creates a consumer group to receive payload
const consumerGroup = await broker.joinConsumerGroup("MyGroup"); 

//Registers a new consumer with Name and Callback for message handlling.
const subscriptionHandle = await consumerGroup.subscribe("Consumer1", newMessageHandler); 

// Handler for arriving Payload
async function newMessageHandler(payload) {
    for (let index = 0; index < payload.length; index++) {
        try {
            const element = payload[index];
            console.log("Payload Id:", element.id); //Payload Id
            console.log("Payload Received from :", element.channel); //Stream name
            console.log("Actual Payload:", element.payload); //Actual Payload
            await element.markAsRead(); //Payload is marked as delivered or Acked also optionaly the message can be dropped.
        }
        catch (exception) {
            console.error(exception);
        }
    }
}

//Provides summary of payloads which have delivered but not acked yet.
const summary = await consumerGroup.pendingSummary();

//Unsubscribes the consumer from the group.
const sucess = consumerGroup.unsubscribe(subscriptionHandle); 

//Amount of memory consumed by this stream in bytes.
const consumedMem = await broker.memoryFootprint();

```

## Built with

1. Authors :heart for Open Source.
2. [shortid](https://www.npmjs.com/package/shortid).

## Contributions

1. New ideas/techniques are welcomed.
2. Raise a Pull Request.

## Current Version:
0.0.8[Beta]

## License

This project is contrubution to public domain and completely free for use, view [LICENSE.md](/license.md) file for details.

