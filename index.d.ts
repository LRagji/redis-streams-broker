import redisNs from 'ioredis'
export declare class StreamChannelBroker {
    constructor(redisClient: redisNs.Redis, channelName: string);
    publish(payload: any, maximumApproximateMessages?: number): Promise<string>;
    destroy(): Promise<boolean>;
    joinConsumerGroup(groupName: string, readFrom: string): Promise<ConsumerGroup>;
    memoryFootprint(): Promise<number>;
}

declare class ConsumerGroup {
    name: string;
    readFrom: string;
    subscribe(consumerName: string, handler: (payload: Payload[]) => Promise<boolean>, pollSpan?: number, payloadsToFetch?: number, subscriptionHandle?: string, readPending?: boolean): Promise<string>;
    unsubscribe(subscriptionHandle: string): Promise<string>;
    pendingSummary(): Promise<GroupSummary>;
}

declare class Payload {
    channel: string;
    id: string;
    payload: any;
    markAsRead(dropMessage?: boolean): Promise<boolean>;
}

declare class GroupSummary {
    total: number;
    firstId: string;
    lastId: string;
    consumerStats: any;
}