const assert = require('assert');
const utils = require('./test-utils');
const localRedisConnectionString = "redis://127.0.0.1:6379/";
const targetType = require('../index');
const channelName = "Channel1";
const maxtimeout = 3000;
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

        let actualTrap = [];
        let expected = { a: "hello", b: "world" };

        //RUN
        let consumerGroup = await target.joinConsumerGroup("MyGroup");
        assert.notDeepEqual(consumerGroup, undefined, "Consumer group cannot be null.");
        await consumerGroup.subscribe("Consumer1", (payload) => actualTrap.push(payload));
        const payloadId = await target.publish(expected);

        await utils.KillTime(maxtimeout);

        //VERIFY
        assert.notDeepEqual(payloadId, undefined, "Payload Id should not be empty.");
        assert.deepEqual(actualTrap[0].length, 1, "Only one payload should be present");
        assert.deepEqual(actualTrap[0][0].id, payloadId, "Payload id cannot be different.");
        assert.deepEqual(actualTrap[0][0].channel, channelName, "Channel name cannot be different.");
        assert.deepEqual(actualTrap[0][0].payload, expected, "Payload is different than what was send.");

    }).timeout(maxtimeout * 2);

})