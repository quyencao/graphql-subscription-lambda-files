const lambdaPlayground = require('graphql-playground-middleware-lambda').default

exports.playgroundHandler = lambdaPlayground({
    endpoint: '/dev/graphql',
    settings: {
        'editor.theme': 'light'
    }
});