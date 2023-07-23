gcloud functions deploy transaction-monitor \
  --gen2 \
  --runtime nodejs18 \
  --entry-point handleTransaction \
  --trigger-http \
  --region europe-central2 \
  --allow-unauthenticated \
  --set-secrets='DB_KEY=TransactionMonitorDBWriteKey:latest' \
  --set-secrets='HELIUS_KEY=HeliusAuthKey:latest' \
  --set-env-vars='DB_URL=https://data.mongodb-api.com/app/data-vhksk/endpoint/data/v1/action/' \
  --service-account='sunrise-378713@appspot.gserviceaccount.com'
#  --source dist/

#gcloud projects add-iam-policy-binding sunrise-378713 \
#  --member='serviceAccount:sunrise-378713@appspot.gserviceaccount.com' \
#  --role='roles/secretmanager.secretAccessor'

#gcloud projects add-iam-policy-binding sunrise-378713 \
#  --member='serviceAccount:ci-serverless-deployment@sunrise-378713.iam.gserviceaccount.com' \
#  --role='roles/secretmanager.secretAccessor'