const assert = require('assert');
const localRedisConnectionString = "redis://127.0.0.1:6379/";
const targetType = require('../index');
const channelName = "Laukik";
let target = null;

describe('RedisStreamsBroker Component Tests', function () {
    this.beforeAll(async function () {
        target = new targetType(localRedisConnectionString, channelName);
    });
    this.afterAll(async function () {
        await target.destroy();
    });
    this.beforeEach(async function () {
        //Clean all keys
        await target._redisClient.flushall();
    });

    it('Should be able to publish and subscribe to a channel.', async function () {

        //RUN
        let consumerGroup = await target.joinConsumerGroup("MyGroup");
        assert.notDeepEqual(consumerGroup, undefined, "Consumer group cannot be null.");
        await consumerGroup.subscribe("Consumer1", (payload) => console.log(payload));
        const payloadId = await target.publish({ a: "hello", b: "world" });

        //VERIFY
        assert.notDeepEqual(payloadId, undefined, "Payload Id should not be empty.");

    });

})