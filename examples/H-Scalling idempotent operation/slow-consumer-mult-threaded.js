//This is a slow consumer which takes 5 seconds to process one packet
//It simply adds LHS & RHS and compare with the result after 5 seconds simulating heavy load or network activity.
//This consumer demonstrates how multi threading can be done to achive Horizontal Scalling.

const Piscina = require('piscina');
const path = require('path');
const Redis = require("ioredis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "hsio";
const redisClient = new Redis(redisConnectionString);
const brokerType = require('redis-streams-broker').StreamChannelBroker;
const broker = new brokerType(redisClient, qName);
const threadPool = new Piscina({
    filename: path.resolve(__dirname, 'payload-processing.js'),
    maxThreads:10,
    minThreads:5
});

// Handler for arriving Payload
async function newMessageHandler(payloads) {
    try {
        const processingHanldes = payloads.map(p => {
            return new Promise((acc, rej) => {
                threadPool.runTask(p.payload)
                    .then(res => {
                        if (res === "" || res ==="Rollover") {
                            p.markAsRead(true)
                                .then(acc)
                                .catch(rej);
                        }
                        else {
                            rej(new Error(res));
                        }
                    })
                    .catch(rej);
            });
        })
        const results = await Promise.allSettled(processingHanldes);
        console.log(`${results.reduce((acc, e) => acc && e.status==="fulfilled", true)?"Success":"Failed"} Allocated Threads:${threadPool.options.minThreads} to ${threadPool.options.maxThreads} Acive: ${threadPool.threads.length} Wait time(p97.5): ${threadPool.waitTime.p97_5} Utilization: ${(threadPool.utilization * 100).toFixed(2)}%`)

    }
    catch (exception) {
        console.error(exception);
    }
}


//Creates a consumer group to receive payload
broker.joinConsumerGroup("MyGroup", 0)
    .then(consumerGroup => consumerGroup.subscribe("Consumer1", newMessageHandler, 5000, 10, "SlowConsumer", true))
    .then(console.log)
    .catch(console.error);
