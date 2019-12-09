const {
  eventProcessor,
  wsHandler,
  httpHandler
} = require("./graphqlServerHelper");

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