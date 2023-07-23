gcloud functions deploy get-neighbours \
  --gen2 \
  --runtime nodejs18 \
  --entry-point getNeighbours \
  --trigger-http \
  --region europe-central2 \
  --allow-unauthenticated \
  --set-secrets='GRAPH_LOOKUP_SECRET=GraphLookupSecret:latest' \
  --set-env-vars='GRAPH_LOOKUP_URL=https://eu-central-1.aws.data.mongodb-api.com/app/graphlookup-zklgq/endpoint/graphLookup' \
  --service-account='sunrise-378713@appspot.gserviceaccount.com'
#  --source dist/

#gcloud projects add-iam-policy-binding sunrise-378713 \
#  --member='serviceAccount:sunrise-378713@appspot.gserviceaccount.com' \
#  --role='roles/secretmanager.secretAccessor'

#gcloud projects add-iam-policy-binding sunrise-378713 \
#  --member='serviceAccount:ci-serverless-deployment@sunrise-378713.iam.gserviceaccount.com' \
#  --role='roles/secretmanager.secretAccessor'