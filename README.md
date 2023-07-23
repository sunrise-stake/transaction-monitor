# transaction-monitor

A pipeline for monitoring gSOL transactions and populating a database with its details  
Some helpful docs

https://jac0xb.medium.com/writing-an-anchor-program-indexer-for-solana-using-helius-webhooks-google-cloud-functions-and-a2f1349ad0b3  
https://cloud.google.com/functions/docs/quickstarts  
https://docs.helius.xyz/solana-data-infrastucture/advanced-infrastructure/solana-indexing  
https://www.mongodb.com/docs/atlas/api/data-api-resources/#find-multiple-documents

For detailed instructions, please refer to the [documentation](https://www.serverless.com/framework/docs/providers/google/).

## Installation/deployment instructions

Depending on your preferred package manager, follow the instructions below to deploy your project.

> **Requirements**: NodeJS `lts/fermium (v.14.15.0)`. If you're using [nvm](https://github.com/nvm-sh/nvm), run `nvm use` to ensure you're using the same Node version in local and in your cloud function's runtime.

### Setup your google project

1. Go to the [API dashboard](https://console.cloud.google.com/apis/dashboard), select your project and enable the following APIs (if not already enabled):

   - Cloud Functions API
   - Cloud Deployment Manager V2 API
   - Cloud Build API
   - Cloud Storage
   - Cloud Logging API

2. Replace `<your-gcp-project-id>` with your project id in `serverles.ts`

### Authenticate

Follow [the authentication doc](https://www.serverless.com/framework/docs/providers/google/guide/credentials/).

**TL;DR**

```shell
gcloud auth application-default login
```

### Install the dependencies

```shell
# with npm
npm i
# or yarn
yarn
```

### Deploy

```shell
# with npm
npm run deploy
# or yarn
yarn deploy
```


### NOTE

Note - after deploying, run the following to make a cloud function public:

```shell
gcloud functions set-iam-policy --region=europe-west1 sunrise-transaction-monitor-dev-httpHello policy.json 
```

This is currently not automated by serverless.