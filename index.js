const redisType = require("ioredis");

module.exports = class StreamChannelBroker {

    constructor(redisConnectionString, channelName) {
        this._redisClient = new redisType(redisConnectionString);
        this._destroying = false;
        this._channelName = channelName;
        this._activeSubscriptions = [];
        this._destroyingCheckWrapper = this._destroyingCheckWrapper.bind(this);
        this.publish = this._destroyingCheckWrapper(this.publish.bind(this));
        this._subscribe = this._destroyingCheckWrapper(this._subscribe.bind(this));
        this.joinConsumerGroup = this._destroyingCheckWrapper(this.joinConsumerGroup.bind(this));
        this.destroy = this._destroyingCheckWrapper(this.destroy.bind(this));
        this._transformResponseToMessage = this._transformResponseToMessage.bind(this);
        this.acknowledgeMessage = this._destroyingCheckWrapper(this.acknowledgeMessage.bind(this));
    }

    _destroyingCheckWrapper(fn, async = true) {

        if (async === true) {
            return async (...theArgs) => {
                if (this._destroying === true) {
                    throw new Error(`Connection is closed to the server, Object under destruction.`);
                }
                return await fn(...theArgs);
            };
        }
        else {
            return (...theArgs) => {
                if (this._destroying === true) {
                    throw new Error(`Connection is closed to the server, Object under destruction.`);
                }
                return fn(...theArgs);
            };
        }
    }

    async _subscribe(groupName, consumerName, handler, pollSpan = 1000, payloadsToFetch = 2) {
        const intervalHandle = setInterval(async () => {
            const messages = await this._redisClient.xreadgroup("GROUP", groupName, consumerName, "COUNT", payloadsToFetch, "STREAMS", this._channelName, ">");
            if (messages !== null) {
                let streamPayloads = this._transformResponseToMessage(messages, consumerName);
                await handler(streamPayloads);
            }
        }, pollSpan);
        this._activeSubscriptions.push(intervalHandle);
        return true;
    }

    async acknowledgeMessage(consumerGroup, messageId) {
        let result = await this._redisClient.xack(this._channelName, consumerGroup, messageId);
        return result === 1;
    }

    _transformResponseToMessage(responses, consumerName) {
        let payloads = [];
        for (let responseIdx = 0; responseIdx < responses.length; responseIdx++) {
            let streamName = responses[responseIdx][0];
            for (let messageIdIdx = 0; messageIdIdx < responses[responseIdx][1].length; messageIdIdx++) {
                let messageId = responses[responseIdx][1][messageIdIdx][0];
                let payload = { "channel": streamName, "id": messageId, "markAsRead": () => this.acknowledgeMessage(consumerName, messageId), payload: {} };
                for (let propertyIdx = 0; propertyIdx < responses[responseIdx][1][messageIdIdx][1].length;) {
                    payload.payload[responses[responseIdx][1][messageIdIdx][1][propertyIdx]] = responses[responseIdx][1][messageIdIdx][1][propertyIdx + 1];
                    propertyIdx += 2;
                }
                payloads.push(payload);
            }
        }
        return payloads;
    }

    async joinConsumerGroup(groupName, readFrom = '$') {
        const keyExists = await this._redisClient.exists(this._channelName);
        if (keyExists === 1) {
            const existingGroups = await this._redisClient.xinfo("GROUPS", this._channelName);
            if (existingGroups.find(e => e[1] === groupName) === undefined) {
                await this._redisClient.xgroup("CREATE", this._channelName, groupName, readFrom);
            }
        }
        else {
            await this._redisClient.xgroup("CREATE", this._channelName, groupName, readFrom, "MKSTREAM");
        }

        return {
            "name": groupName,
            "readFrom": readFrom,
            "subscribe": (...theArgs) => this._subscribe(groupName, ...theArgs)
        }
    }


    async publish(payload, maximumApproximateMessages = 100) {
        let keyValuePairs = [];
        const payloadType = typeof payload;
        switch (payloadType) {
            case "object":
                for (const [key, value] of Object.entries(payload)) {
                    keyValuePairs.push(key);
                    keyValuePairs.push(JSON.stringify(value) || value);
                }
                break;
            default:
                throw new Error(`Payload of type ${payloadType} is not supported.`);
        }

        if (keyValuePairs.length === 0) {
            throw new Error(`Payload cannot be empty.`);
        }

        return await this._redisClient.xadd(this._channelName, 'MAXLEN', '~', maximumApproximateMessages, '*', ...keyValuePairs);
    }

    async destroy() {
        this._destroying = true;
        this._activeSubscriptions.forEach(interval => clearInterval(interval));
        await this._redisClient.quit();
        await this._redisClient.disconnect();
    }

}