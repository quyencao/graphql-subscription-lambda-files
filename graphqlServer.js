const {
  createDynamoDBEventProcessor,
  createWsHandler,
  DynamoDBConnectionManager,
  DynamoDBEventStore,
  DynamoDBSubscriptionManager,
  PubSub
} = require('aws-lambda-graphql');
const { makeExecutableSchema } = require('graphql-tools');
const { gql } = require('apollo-server-lambda');
const createHttpHandler = require("./createHttpHandler");

const eventStore = new DynamoDBEventStore({ eventsTable: process.env.EVENTS_TABLE });
const pubSub = new PubSub({ eventStore });

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ gql`
    type Message {
      id: ID!
      text: String!
    }
    type Mutation {
      sendMessage(text: String!): Message!
      createMessage(text: String!): Message!
    }
    type Query {
      serverTime: Float!
    }
    type Subscription {
      messageFeed: Message!
      createMessage: Message!
    }
  `,
  resolvers: {
    Mutation: {
      sendMessage: async (rootValue, { text }) => {
        const payload = { id: "1234", text };

        await pubSub.publish('NEW_MESSAGE', payload);

        return payload;
      },
      createMessage: async (rootValue, { text }) => {
        const payload = { id: "5678", text };

        await pubSub.publish('CREATE_MESSAGE', payload);

        return payload;
      }
    },
    Query: {
      serverTime: () => Date.now(),
    },
    Subscription: {
      messageFeed: {
        resolve: rootValue => rootValue,
        subscribe: pubSub.subscribe('NEW_MESSAGE')
      },
      createMessage: {
        resolve: rootValue => rootValue,
        subscribe: pubSub.subscribe('CREATE_MESSAGE')
      }
    },
  }
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

exports.handler = function handler(
  event,
  context,
) {
  // detect event type
  if (event.Records != null) {
    // event is DynamoDB stream event
    return eventProcessor(event, context);
  }
  if (
    event.requestContext != null &&
    event.requestContext.routeKey != null
  ) {
    // event is web socket event from api gateway v2
    return wsHandler(event, context);
  }

  if (
    event.requestContext != null &&
    event.requestContext.path != null
  ) {
    // event is http event from api gateway v1
    return httpHandler(event, context);
  }
  throw new Error('Invalid event');
}