// This is a fast producer which means it will generate load which is higher than the processing rate of the system
// Since the consumer is a simple addition of 2 numbers with a sleep of 5 seconds, we will be generating a load of 1 sample/sec


const Redis = require("ioredis");
const redisConnectionString = "redis://127.0.0.1:6379/";
const qName = "hsio";
const redisClient = new Redis(redisConnectionString);
const brokerType = require('redis-streams-broker').StreamChannelBroker;
const broker = new brokerType(redisClient, qName);

function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function dataInserts() {
    let payload = { lhs: randomNumber(0, 10000000), rhs: randomNumber(0, 10000000) };
    payload.result = payload.lhs + payload.rhs;
    payload.result = payload.result.toString();
    payload.lhs = payload.lhs.toString();
    payload.rhs = payload.rhs.toString();
    broker.publish(payload, 50)
        .then(r => {
            if (r === false) {
                console.log("Failed to publish.")
            }
            else {
                redisClient.xrange(qName, "-", "+")
                    .then((data) => {
                        console.clear();
                        console.table(data)
                    });
            }
        })
        .catch(console.error);
}


setInterval(dataInserts, 1000);
