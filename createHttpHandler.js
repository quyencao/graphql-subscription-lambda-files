const contentType = require('content-type');
const querystring = require('querystring');
const { ExtendableError } = require('aws-lambda-graphql/dist/errors');
const { execute } = require('aws-lambda-graphql/dist/execute');

class HTTPError extends ExtendableError {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function normalizeHeaders(event) {
  Object.keys(event.headers).forEach(header => {
    event.headers[header.toLowerCase()] = event.headers[header];
  });
  event.headers["Access-Control-Allow-Origin"] = "*";
  event.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
}

function parseGraphQLParams(event) {
  switch (event.httpMethod) {
    case 'GET': {
      // get cannot have a body so parse operation from query params
      throw new HTTPError(405, 'Method not allowed');
    }
    case 'POST': {
      const parsedType = contentType.parse(event.headers['content-type']);

      switch (parsedType.type) {
        case 'application/json': {
          return JSON.parse(event.body);
        }
        case 'application/x-www-form-urlencoded': {
          return querystring.parse(event.body);
        }
        default: {
          throw new HTTPError(400, 'Invalid request content type');
        }
      }
    }
    default: {
      throw new HTTPError(405, 'Method not allowed');
    }
  }
}

function createHttpHandler({
  connectionManager,
  context,
  schema,
  validationRules,
}) {
  return async function serveHttp(event, lambdaContext) {
    try {
      // normalize headers to lower case
      normalizeHeaders(event);

      const operation = parseGraphQLParams(event);
      const result = await execute({
        connectionManager,
        event,
        lambdaContext,
        operation,
        context,
        schema,
        connection: {},
        pubSub: {},
        subscriptionManager: {},
        useSubscriptions: false,
        validationRules,
      });

      return {
        body: JSON.stringify(result),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
        },
        statusCode: 200,
      };
    } catch (e) {
      if (e instanceof HTTPError) {
        return { statusCode: e.statusCode, body: e.message };
      }

      return { statusCode: 500, body: e.message || 'Internal server error' };
    }
  };
}

module.exports = createHttpHandler;