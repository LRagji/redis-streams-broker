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

    it('Should be able to publish, subscribe and acknowledge messages on a channel.', async function () {

        let actualTrap = [];
        const consumerName = "Consumer1";
        let expected = {
            string: "hello world!"
        };

        //RUN
        let consumerGroup = await target.joinConsumerGroup("MyGroup");
        assert.notDeepEqual(consumerGroup, undefined, "Consumer group cannot be null.");
        const subscription = await consumerGroup.subscribe(consumerName, (payload) => actualTrap.push(payload));
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

        //Validate Pending
        let summary = await consumerGroup.pendingSummary();
        assert.deepEqual(summary.total, 1, "Only one message should be pending.");
        assert.deepEqual(summary.consumerStats[consumerName], 1, "Only one message should be pending for Consumer1.");

        //Acknowledge Message
        const ackResult = await actualTrap[0][0].markAsRead();
        assert.deepEqual(ackResult, true, "Failed to acknowledge message.");

        //Re-Validate Pending
        summary = await consumerGroup.pendingSummary();
        assert.deepEqual(summary.total, 0, "No messages should be pending.");
        assert.deepEqual(summary.consumerStats, {}, "Consumer stats should be empty.");

        //Unsubscribe
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

    it('Should send payload to only one consumer in single group.', async function () {

        let actualTrapConsumer1 = [];
        let actualTrapConsumer2 = [];
        let expected = {
            string: "hello world!"
        };

        //RUN
        let consumerGroup = await target.joinConsumerGroup("MyGroup");
        assert.notDeepEqual(consumerGroup, undefined, "Consumer group cannot be null.");
        const subscription1 = await consumerGroup.subscribe("Consumer1", (payload) => actualTrapConsumer1.push(payload));
        const subscription2 = await consumerGroup.subscribe("Consumer2", (payload) => actualTrapConsumer2.push(payload));
        const payloadId = await target.publish(expected);

        await utils.KillTime(maxtimeout);

        //VERIFY
        assert.notDeepEqual(subscription1, undefined, "Incorrect subscription handle, for consumer 1");
        assert.notDeepEqual(subscription2, undefined, "Incorrect subscription handle, for consumer 2");
        assert.deepEqual(actualTrapConsumer1.length + actualTrapConsumer2.length, 1, "Only one payload should be present for only one consumer");
        const actual = actualTrapConsumer1.length > 0 ? actualTrapConsumer1[0] : actualTrapConsumer2[0];
        assert.deepEqual(actual.length, 1, "Only one sample should be present.");
        assert.deepEqual(actual.length, 1, "Only one payload should be present");
        assert.deepEqual(actual[0].id, payloadId, "Payload id cannot be different.");
        assert.deepEqual(actual[0].channel, channelName, "Channel name cannot be different.");
        assert.deepEqual(actual[0].payload, expected, "Payload is different than what was send.");

        const consumer1Sub = consumerGroup.unsubscribe(subscription1);
        assert.deepEqual(consumer1Sub, true, "Failed to unsubscribe, for consumer 1");
        const consumer2Sub = consumerGroup.unsubscribe(subscription2);
        assert.deepEqual(consumer2Sub, true, "Failed to unsubscribe, for consumer 2");

    }).timeout(maxtimeout * 2);

    it('Should send only 2 payloads per consumer in single group, when multiple published messages are available.', async function () {

        let actualTrapConsumer1 = [];
        let actualTrapConsumer2 = [];
        let expected1 = {
            string: "hello world!",
            id: "1"
        };
        let expected2 = {
            string: "hello world!",
            id: "2"
        };
        let expected3 = {
            string: "hello world!",
            id: "3"
        };
        let expected4 = {
            string: "hello world!",
            id: "4"
        };

        //RUN
        let consumerGroup = await target.joinConsumerGroup("MyGroup");
        assert.notDeepEqual(consumerGroup, undefined, "Consumer group cannot be null.");
        const subscription1 = await consumerGroup.subscribe("Consumer1", (payload) => actualTrapConsumer1.push(payload));
        const subscription2 = await consumerGroup.subscribe("Consumer2", (payload) => actualTrapConsumer2.push(payload));
        const publishMap = new Map();
        publishMap.set(await target.publish(expected1), expected1);
        publishMap.set(await target.publish(expected2), expected2);
        publishMap.set(await target.publish(expected3), expected3);
        publishMap.set(await target.publish(expected4), expected4);

        await utils.KillTime(maxtimeout);

        //VERIFY
        assert.notDeepEqual(subscription1, undefined, "Incorrect subscription handle, for consumer 1");
        assert.notDeepEqual(subscription2, undefined, "Incorrect subscription handle, for consumer 2");
        assert.deepEqual(actualTrapConsumer1.length, 1, "Only one payload should be present for consumer1");
        assert.deepEqual(actualTrapConsumer2.length, 1, "Only one payload should be present for consumer2");
        assert.deepEqual(actualTrapConsumer1[0].length, 2, "Only 2 samples should be present for consumer 1");
        assert.deepEqual(actualTrapConsumer2[0].length, 2, "Only 2 samples should be present for consumer 2");

        let expected = publishMap.get(actualTrapConsumer1[0][0].id);
        assert.notDeepEqual(expected, undefined, "Expected cannot be null for consumer 1 sample 1.");
        assert.deepEqual(actualTrapConsumer1[0][0].channel, channelName, "Channel name cannot be different for consumer 1 sample 1.");
        assert.deepEqual(actualTrapConsumer1[0][0].payload, expected, "Payload is different than what was sent for consumer 1 sample 1.");

        expected = publishMap.get(actualTrapConsumer1[0][1].id);
        assert.notDeepEqual(expected, undefined, "Expected cannot be null for consumer 1 sample 2.");
        assert.deepEqual(actualTrapConsumer1[0][1].channel, channelName, "Channel name cannot be different for consumer 1 sample 2.");
        assert.deepEqual(actualTrapConsumer1[0][1].payload, expected, "Payload is different than what was sent for consumer 1 sample 2.");

        expected = publishMap.get(actualTrapConsumer2[0][0].id);
        assert.notDeepEqual(expected, undefined, "Expected cannot be null for consumer 2 sample 1.");
        assert.deepEqual(actualTrapConsumer2[0][0].channel, channelName, "Channel name cannot be different for consumer 2 sample 1.");
        assert.deepEqual(actualTrapConsumer2[0][0].payload, expected, "Payload is different than what was sent for consumer 2 sample 1.");

        expected = publishMap.get(actualTrapConsumer2[0][1].id);
        assert.notDeepEqual(expected, undefined, "Expected cannot be null for consumer 1 sample 2.");
        assert.deepEqual(actualTrapConsumer2[0][1].channel, channelName, "Channel name cannot be different for consumer 2 sample 2.");
        assert.deepEqual(actualTrapConsumer2[0][1].payload, expected, "Payload is different than what was sent for consumer 2 sample 2.");

        const consumer1Sub = consumerGroup.unsubscribe(subscription1);
        assert.deepEqual(consumer1Sub, true, "Failed to unsubscribe, for consumer 1");
        const consumer2Sub = consumerGroup.unsubscribe(subscription2);
        assert.deepEqual(consumer2Sub, true, "Failed to unsubscribe, for consumer 2");

    }).timeout(maxtimeout * 2);
})