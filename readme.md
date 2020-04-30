# redis-streams-broker

This simple package is based on redis streams data type which provides you with following features 
1. Centeralized Que. (Using Redis)
2. Guarantee of message delivery via consumer acknowledgements.
3. Consumer Group functionality for scalability. (Just like Kafka)

## Getting Started

1. Install using `npm -i redis-streams-broker`
2. Require in your project. `const brokerType = require('redis-streams-broker').StreamChannelBroker;`
3. Run redis on local docker if required. `docker run --name streamz -p 6379:6379 -itd --rm redis:latest`
3. Instantiate with a redis connection and name for the stream. `const broker = new brokerType(redisConnectionString, name);`
4. All done, Start using it!!.

## Examples/Code snippets

```javascript
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "Queue";
const brokerType = require('redis-streams-broker').StreamChannelBroker;
const broker = new brokerType(redisConnectionString, qName);

const payloadId = await broker.publish({ a: "Hello", b: "World" }); //Used to publish a paylod on stream.

const consumerGroup = await broker.joinConsumerGroup("MyGroup"); //Creates a consumer group to receive payload

const subscriptionHandle = await consumerGroup.subscribe("Consumer1", newMessageHandler); //Registers a new consumer with Name and Callback for message handlling.

async function newMessageHandler(payload) {
    console.log("Payload Id:", payload.id); //Payload Id
    console.log("Payload Received from :", payload.channel); //Stream name
    console.log("Actual Payload:", payload.payload); //Actual Payload
    await payload.markAsRead(); //Payload is marked as delivered or Acked.
}

const summary = await consumerGroup.pendingSummary(); //Provides summary of payloads which have delivered but not acked yet.

const sucess = consumerGroup.unsubscribe(subscriptionHandle); //Unsubscribes the consumer from the group.

const consumedMem = await broker.memoryFootprint(); //Amount of memory consumed by this stream in bytes.

```

## Built with

1. Authors love for Open Source.
2. [IORedis](https://www.npmjs.com/package/ioredis).

## Contributions

1. New ideas/techniques are welcomed.
2. Raise a Pull Request.

## Current Version:
0.0.5[Beta]

## License

This project is contrubution to public domain and completely free for use, view [LICENSE.md](/license.md) file for details.
