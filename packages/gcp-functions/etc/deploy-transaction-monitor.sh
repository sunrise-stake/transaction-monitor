gcloud functions deploy transaction-monitor \
  --gen2 \
  --runtime nodejs18 \
  --entry-point handleTransaction \
  --trigger-http \
  --region europe-central2 \
  --allow-unauthenticated \
  --set-secrets='DB_URI=MongoDBURI:latest' \
  --set-secrets='HELIUS_KEY=HeliusAuthKey:latest' \
  --service-account='sunrise-378713@appspot.gserviceaccount.com'
#  --source dist/

#gcloud projects add-iam-policy-binding sunrise-378713 \
#  --member='serviceAccount:sunrise-378713@appspot.gserviceaccount.com' \
#  --role='roles/secretmanager.secretAccessor'

#gcloud projects add-iam-policy-binding sunrise-378713 \
#  --member='serviceAccount:ci-serverless-deployment@sunrise-378713.iam.gserviceaccount.com' \
#  --role='roles/secretmanager.secretAccessor'