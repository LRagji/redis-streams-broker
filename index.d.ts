
export declare class StreamChannelBroker {
    constructor(redisClient: any, channelName: string);
    publish(payload: any, maximumApproximateMessages?: number, failOnMaxMessageCount: boolean): Promise<string>;
    destroy(): Promise<boolean>;
    joinConsumerGroup(groupName: string, readFrom: string): Promise<ConsumerGroup>;
    memoryFootprint(): Promise<number>;
}

declare class ConsumerGroup {
    name: string;
    readFrom: string;
    subscribe(consumerName: string, handler: (payload: Payload[]) => Promise<number>, pollSpan?: number, payloadsToFetch?: number, subscriptionHandle?: string, readPending?: boolean): Promise<string>;
    unsubscribe(subscriptionHandle: string): Promise<boolean>;
    pendingSummary(): Promise<GroupSummary>;
}

declare class Payload {
    channel: string;
    id: string;
    payload: any;
    markAsRead(deleteMessage?: boolean): Promise<boolean>;
}

declare class GroupSummary {
    total: number;
    firstId: string;
    lastId: string;
    consumerStats: any;
}