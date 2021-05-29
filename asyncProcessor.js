module.exports = class AsyncProcessor {
    #dataProcessingHandler
    #errorHandler
    #processingBudget
    #activeWork = new Map()
    #unsubscribe = null;

    constructor(dataProcessingHandler, processingBudget = 3, errorHandler = (err) => Promise.resolve(console.error(err))) {
        this.#dataProcessingHandler = dataProcessingHandler;
        this.#processingBudget = processingBudget;
        this.#errorHandler = errorHandler;

        this.streamHandler = this.streamHandler.bind(this);
        this.waitForAllCompletion = this.waitForAllCompletion.bind(this);
        this.activeItems = this.activeItems.bind(this);
        this._processItem = this._processItem.bind(this);
        this._holdForItemCompletion = this._holdForItemCompletion.bind(this);
    }

    async streamHandler(payloads) {
        do {
            if (this.#activeWork.size >= this.#processingBudget) {
                await this._holdForItemCompletion();
            }

            if (payloads.length > 0) {
                const payload = payloads.pop();
                const itemProcessingPromise = this._processItem(payload);
                this.#activeWork.set(payload.id, itemProcessingPromise);
            }
        }
        while (payloads.length > 0 || this.#activeWork.size >= this.#processingBudget)

        return this.#unsubscribe || (this.#processingBudget - this.#activeWork.size);
    }

    async waitForAllCompletion(unsubscribe = false) {
        if (unsubscribe === true) {
            this.#unsubscribe = -1;
        }
        do {
            await this._holdForItemCompletion();
        }
        while (this.#activeWork.size > 0)
    }

    activeItems() {
        return this.#activeWork.size;
    }

    async _holdForItemCompletion() {
        if (this.#activeWork.size > 0) {
            const completedPayloadId = await Promise.race(this.#activeWork.values());
            if (this.#activeWork.has(completedPayloadId) === true) {
                this.#activeWork.delete(completedPayloadId);
            }
            else {
                await this.#errorHandler(new Error(`Payload(${completedPayloadId}) is missing from active work list.`));
            }
        }
        else {
            return Promise.resolve();
        }
    }

    async _processItem(payload) {
        try {
            let handlerResult = await this.#dataProcessingHandler(payload.channel, payload.id, payload.payload)
            if (handlerResult[0] === true && handlerResult[1] === true) {
                await payload.markAsRead(true);
            }
            else if (handlerResult[0] === true && handlerResult[1] === false) {
                await payload.markAsRead(false);
            }
        }
        catch (err) {
            err.id = payload.id;
            await this.#errorHandler(err);
        }
        finally {
            return payload.id;
        }
    }
}