const { DynamoDBEventStore, PubSub } = require('aws-lambda-graphql');

const eventStore = new DynamoDBEventStore({ eventsTable: process.env.EVENTS_TABLE });

module.exports = new PubSub({ eventStore });