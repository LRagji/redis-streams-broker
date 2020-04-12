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
        //const target = new targetType(localRedisConnectionString, channelName);

        let actualTrap = [];
        let expected = {
            string: "hello world!"
        };

        //RUN
        let consumerGroup = await target.joinConsumerGroup("MyGroup");
        assert.notDeepEqual(consumerGroup, undefined, "Consumer group cannot be null.");
        const subscription = await consumerGroup.subscribe("Consumer1", (payload) => actualTrap.push(payload));
        const payloadId = await target.publish(expected);

        await utils.KillTime(maxtimeout);

        //VERIFY
        assert.notDeepEqual(subscription, undefined, "Incorrect subscription handle.");
        assert.deepEqual(actualTrap.length, 1, "Only one payload should be present.");
        assert.deepEqual(actualTrap[0].length, 1, "Only one sample should be present.");
        assert.deepEqual(actualTrap[0].length, 1, "Only one payload should be present");
        assert.deepEqual(actualTrap[0][0].id, payloadId, "Payload id cannot be different.");
        assert.deepEqual(actualTrap[0][0].channel, channelName, "Channel name cannot be different.");
        assert.deepEqual(actualTrap[0][0].payload, expected, "Payload is different than what was send.");

        const result = consumerGroup.unsubscribe(subscription);
        assert.deepEqual(result, true, "Failed to unsubscribe.");

    }).timeout(maxtimeout * 2);

    it('Should broadcast payloads to all groups.', async function () {

        let actualTrapGroup1 = [];
        let actualTrapGroup2 = [];
        let expected = {
            string: "hello world!"
        };

        //Create Group1
        let consumerGroup1 = await target.joinConsumerGroup("MyGroup1");
        assert.notDeepEqual(consumerGroup1, undefined, "Consumer group cannot be null.");
        const subscription1 = await consumerGroup1.subscribe("Consumer1", (payload) => actualTrapGroup1.push(payload));

        //Create Group2
        let consumerGroup2 = await target.joinConsumerGroup("MyGroup2");
        assert.notDeepEqual(consumerGroup2, undefined, "Consumer group cannot be null.");
        const subscription2 = await consumerGroup2.subscribe("Consumer1", (payload) => actualTrapGroup2.push(payload));

        //Publish data
        const payloadId = await target.publish(expected);

        //Wait for Process
        await utils.KillTime(maxtimeout);

        //VERIFY
        assert.notDeepEqual(payloadId, undefined, "Payload Id should not be empty.");

        assert.deepEqual(actualTrapGroup1.length, 1, "Only one payload should be present, consumer group 1");
        assert.deepEqual(actualTrapGroup1[0].length, 1, "Only one sample should be present, consumer group 1");
        assert.deepEqual(actualTrapGroup1[0][0].id, payloadId, "Payload id cannot be different, consumer group 1");
        assert.deepEqual(actualTrapGroup1[0][0].channel, channelName, "Channel name cannot be different, consumer group 1");
        assert.deepEqual(actualTrapGroup1[0][0].payload, expected, "Payload is different than what was send, consumer group 1");
        const group1Unsubscribe = consumerGroup1.unsubscribe(subscription1);
        assert.deepEqual(group1Unsubscribe, true, "Failed to unsubscribe, Group1");

        assert.deepEqual(actualTrapGroup2.length, 1, "Only one payload should be present, consumer group 2");
        assert.deepEqual(actualTrapGroup2[0].length, 1, "Only one sample should be present, consumer group 2");
        assert.deepEqual(actualTrapGroup2[0][0].id, payloadId, "Payload id cannot be different, consumer group 2");
        assert.deepEqual(actualTrapGroup2[0][0].channel, channelName, "Channel name cannot be different, consumer group 2");
        assert.deepEqual(actualTrapGroup2[0][0].payload, expected, "Payload is different than what was send, consumer group 2");
        const group2Unsubscribe = consumerGroup2.unsubscribe(subscription2);
        assert.deepEqual(group2Unsubscribe, true, "Failed to unsubscribe, Group2");

    }).timeout(maxtimeout * 2);

})