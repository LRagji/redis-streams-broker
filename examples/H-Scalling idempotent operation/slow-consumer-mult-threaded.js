//This is a slow consumer which takes 5 seconds to process one packet
//It simply adds LHS & RHS and compare with the result after 5 seconds simulating heavy load or network activity.

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
    const Redis = require("ioredis");
    const redisConnectionString = "redis://127.0.0.1:6379/";
    const qName = "hsio";
    const redisClient = new Redis(redisConnectionString);
    const brokerType = require('redis-streams-broker').StreamChannelBroker;
    const broker = new brokerType(redisClient, qName);


    // Handler for arriving Payload
    async function newMessageHandler(payloads) {
        try {
            const threadProcessMap = new Map();
            for (let index = 0; index < payloads.length; index++) {
                const element = payloads[index];
                const processing = new Promise((accept, reject) => {
                    const worker = new Worker(__filename, { workerData: JSON.stringify(element.payload) });
                    worker.on('message', (threadResponse) => {
                        if (threadResponse === "") {
                            element.markAsRead(true)
                                .then(accept);
                        }
                        else {
                            reject(new Error(threadResponse));
                        }
                    });
                    worker.on('error', reject);
                    worker.on('exit', (code) => {
                        if (code !== 0)
                            reject(new Error(`Worker stopped with exit code ${code}`));
                    });
                });

                threadProcessMap.set(element.id, processing);
            }
            const results = await Promise.all(Array.from(threadProcessMap.values));
            console.table(results);
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

}
else {
    const data = JSON.parse(workerData);
    console.log(data);
    if ((parseInt(data.lhs) + parseInt(data.rhs)) === parseInt(data.result)) {
        const delay = new Promise((acc, rej) => setTimeout(acc, 5000));// Fake delay simulating network or cpu load.
        delay
            .then(r => parentPort.postMessage(""))
            .catch(err => parentPort.postMessage( err.message ));
    }
    else {
        parentPort.postMessage("Failed math exam!!!" );
    }
}