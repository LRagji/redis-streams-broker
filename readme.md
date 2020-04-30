# redis-streams-broker

This simple package is based on redis streams data type which provides you with following features 
1. Centralized Que. (Using Redis)
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

//Used to publish a paylod on stream.
const payloadId = await broker.publish({ a: "Hello", b: "World" }); 

//Creates a consumer group to receive payload
const consumerGroup = await broker.joinConsumerGroup("MyGroup"); 

//Registers a new consumer with Name and Callback for message handlling.
const subscriptionHandle = await consumerGroup.subscribe("Consumer1", newMessageHandler); 

// Handler for arriving Payload
async function newMessageHandler(payload) {
    console.log("Payload Id:", payload.id); //Payload Id
    console.log("Payload Received from :", payload.channel); //Stream name
    console.log("Actual Payload:", payload.payload); //Actual Payload
    await payload.markAsRead(); //Payload is marked as delivered or Acked.
}

//Provides summary of payloads which have delivered but not acked yet.
const summary = await consumerGroup.pendingSummary();

//Unsubscribes the consumer from the group.
const sucess = consumerGroup.unsubscribe(subscriptionHandle); 

//Amount of memory consumed by this stream in bytes.
const consumedMem = await broker.memoryFootprint();

```

## Built with

1. Authors love for Open Source.
2. [IORedis](https://www.npmjs.com/package/ioredis).
3. [shortid](https://www.npmjs.com/package/shortid).

## Contributions

1. New ideas/techniques are welcomed.
2. Raise a Pull Request.

## Current Version:
0.0.5[Beta]

## License

This project is contrubution to public domain and completely free for use, view [LICENSE.md](/license.md) file for details.
