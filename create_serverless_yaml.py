import os
import yaml
from jinja2 import Template
from six import text_type as _text_type

def _create_serverless_yaml(args):
    serverless_template = Template("""
service: {{ APP_ID }}
provider:
  name: aws
  stage: dev
  runtime: {{ RUNTIME }}
  environment:
    DB_HOST: {{ DB_HOST }}
    DB_PORT: {{ DB_PORT }}
    DB_NAME: {{ DB_NAME }}
    DB_USERNAME: {{ DB_USERNAME }}
    DB_PASSWORD: {{ DB_PASSWORD }}
    CONNECTIONS_TABLE: {{ APP_ID }}_Connections
    EVENTS_TABLE: {{ APP_ID }}_Events
    SUBSCRIPTIONS_TABLE: {{ APP_ID }}_Subscriptions
    SUBSCRIPTION_OPERATIONS_TABLE: {{ APP_ID }}_SubscriptionOperations
  iamRoleStatements:
    - Effect: Allow
      Action:
        - execute-api:ManageConnections
      Resource: 'arn:aws:execute-api:*:*:*/development/POST/@connections/*'
    - Effect: Allow
      Action:
        - dynamodb:DeleteItem
        - dynamodb:GetItem
        - dynamodb:PutItem
        - dynamodb:UpdateItem
      Resource: !GetAtt ConnectionsDynamoDBTable.Arn
    - Effect: Allow
      Action:
        - dynamodb:DescribeStream
        - dynamodb:GetRecords
        - dynamodb:GetShardIterator
        - dynamodb:ListStreams
      Resource: !GetAtt EventsDynamoDBTable.StreamArn
    - Effect: Allow
      Action:
        - dynamodb:PutItem
      Resource: !GetAtt EventsDynamoDBTable.Arn
    - Effect: Allow
      Action:
        - dynamodb:BatchWriteItem
        - dynamodb:DeleteItem
        - dynamodb:GetItem
        - dynamodb:PutItem
        - dynamodb:Query
        - dynamodb:Scan
      Resource: !GetAtt SubscriptionsDynamoDBTable.Arn
    - Effect: Allow
      Action:
        - dynamodb:BatchWriteItem
        - dynamodb:DeleteItem
        - dynamodb:GetItem
        - dynamodb:PutItem
      Resource: !GetAtt SubscriptionOperationsDynamoDBTable.Arn
{% if RUNTIME == "python3.6" %}
plugins:
  - serverless-python-requirements

custom:
  pythonRequirements:
    dockerizePip: non-linux
{% endif %}
functions:
  {% if RUNTIME == "python3.6" %}
  graphql:
    # this is formatted as <FILENAME>.<HANDLER>
    handler: graphqlServer.graphqlHandler
    events:
      - http:
          path: graphql
          method: post
          cors: true
  playground:
    handler: playgroundServer.playgroundHandler
    runtime: nodejs10.x
    events:
      - http:
          path: graphql
          method: get
          cors: true
  {% else %}
  graphqlHttp:
    handler: graphqlServer.handler
    runtime: nodejs10.x
    events:
      - http:
          path: graphql
          method: post
          cors: true
  playground:
    handler: playgroundServer.playgroundHandler
    runtime: nodejs10.x
    events:
      - http:
          path: graphql
          method: get
          cors: true
  graphqlSocket:
    handler: graphqlServer.handler
    events:
        - websocket: 
            route: $connect
        - websocket: 
            route: $disconnect
        - websocket: 
            route: $default
        - stream:
            type: dynamodb
            arn:
                Fn::GetAtt: [ EventsDynamoDBTable, StreamArn ]
  {% endif %}
resources:
  Resources:
    ConnectionsDynamoDBTable:
      Type: AWS::DynamoDB::Table
      Properties:
        # see DynamoDBConnectionManager
        TableName: ${self:provider.environment.CONNECTIONS_TABLE}
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        BillingMode: PAY_PER_REQUEST
        KeySchema:
          # connection id
          - AttributeName: id
            KeyType: HASH

    SubscriptionsDynamoDBTable:
      Type: AWS::DynamoDB::Table
      Properties:
        # see DynamoDBSubscriptionManager
        TableName: ${self:provider.environment.SUBSCRIPTIONS_TABLE}
        AttributeDefinitions:
          - AttributeName: event
            AttributeType: S
          - AttributeName: subscriptionId
            AttributeType: S
        BillingMode: PAY_PER_REQUEST
        KeySchema:
          - AttributeName: event
            KeyType: HASH
          - AttributeName: subscriptionId
            KeyType: RANGE

    SubscriptionOperationsDynamoDBTable:
      Type: AWS::DynamoDB::Table
      Properties:
        # see DynamoDBSubscriptionManager
        TableName: ${self:provider.environment.SUBSCRIPTION_OPERATIONS_TABLE}
        AttributeDefinitions:
          - AttributeName: subscriptionId
            AttributeType: S
        BillingMode: PAY_PER_REQUEST
        KeySchema:
          - AttributeName: subscriptionId
            KeyType: HASH

    EventsDynamoDBTable:
      Type: AWS::DynamoDB::Table
      Properties:
        # see DynamoDBEventStore
        TableName: ${self:provider.environment.EVENTS_TABLE}
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        BillingMode: PAY_PER_REQUEST
        # see ISubscriptionEvent
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        StreamSpecification:
          StreamViewType: NEW_IMAGE
    """)
    serverless_text = serverless_template.render({ 
        "APP_ID": args.appId, 
        "RUNTIME": args.runtime, 
        "DB_HOST": args.host, 
        "DB_PORT": args.port,
        "DB_NAME": args.name,
        "DB_USERNAME": args.username,
        "DB_PASSWORD": args.password
    })

    with open(args.outputPath, mode="w") as f:
        f.write(serverless_text)

def _get_parser():
    import argparse

    parser = argparse.ArgumentParser(description="Create serverless yaml file")

    parser.add_argument(
        "--appId", "-a",
        type=_text_type,
        help="App ID"
    )

    parser.add_argument(
      "--runtime", "-r",
      type=_text_type,
      help="Runtime",
      default="nodejs10.x"
    )

    parser.add_argument(
      "--host", "-hn",
      type=_text_type,
      help="Database Host"
    )

    parser.add_argument(
      "--port", "-p",
      type=_text_type,
      help="Port"
    )

    parser.add_argument(
      "--name", "-n",
      type=_text_type,
      help="Database Name"
    )

    parser.add_argument(
      "--username", "-u",
      type=_text_type,
      help="Database username"
    )

    parser.add_argument(
      "--password", "-pw",
      type=_text_type,
      help="Database password"
    )

    parser.add_argument(
        "--outputPath", "-o",
        type=_text_type,
        help="Serverless config output file",
        default="serverless.yaml"
    )

    return parser

def _main():
    parser = _get_parser()
    args = parser.parse_args()
    _create_serverless_yaml(args)

if __name__ == "__main__":
    _main()