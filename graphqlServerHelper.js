const {
    createDynamoDBEventProcessor,
    createWsHandler,
    DynamoDBConnectionManager,
    DynamoDBEventStore,
    DynamoDBSubscriptionManager,
    PubSub
} = require('aws-lambda-graphql');
const { makeExecutableSchema } = require('graphql-tools');
const createHttpHandler = require("./createHttpHandler");
const resolvers = require("./resolvers");
const typeDefs = require("./schema");

const eventStore = new DynamoDBEventStore({ eventsTable: process.env.EVENTS_TABLE });
const pubSub = new PubSub({ eventStore });

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

const subscriptionManager = new DynamoDBSubscriptionManager({
  subscriptionsTableName: process.env.SUBSCRIPTIONS_TABLE,
  subscriptionOperationsTableName: process.env.SUBSCRIPTION_OPERATIONS_TABLE
});

const connectionManager = new DynamoDBConnectionManager({
  subscriptions: subscriptionManager,
  connectionsTable: process.env.CONNECTIONS_TABLE
});

const eventProcessor = createDynamoDBEventProcessor({
  connectionManager,
  schema,
  subscriptionManager,
});

const wsHandler = createWsHandler({
  connectionManager,
  schema,
  subscriptionManager,
});

const httpHandler = createHttpHandler({
  connectionManager,
  schema,
});

module.exports = {
    pubSub,
    eventProcessor,
    wsHandler,
    httpHandler
};