gcloud functions deploy get-leaderboard \
  --gen2 \
  --runtime nodejs18 \
  --entry-point getLeaderboard \
  --trigger-http \
  --region europe-central2 \
  --allow-unauthenticated \
  --set-secrets='DB_URI=MongoDBURI:latest' \
  --service-account='sunrise-378713@appspot.gserviceaccount.com'
