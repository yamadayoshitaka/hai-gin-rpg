{
  "kind": "ONE_TIME_CLOUDFLARE_FREE_FLUX2_FIVE_NATIVE_FRAMES",
  "stageId": "c01-s02",
  "edition": "post-victory",
  "gender": "female",
  "page": 1,
  "panels": [
    "c01-s02-m6",
    "c01-s02-m7",
    "c01-s02-m8",
    "c01-s02-m9",
    "c01-s02-m16"
  ],
  "mode": "generate",
  "maxImages": 5,
  "requiresConfirmedWorkersFreePlan": true,
  "requiredGitHubSecrets": [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_WORKERS_AI_API_TOKEN"
  ],
  "requiredVariable": "CLOUDFLARE_FREE_PLAN_CONFIRMED=true",
  "maxEstimatedNeuronsPerRun": 1000,
  "unapprovedArtOnly": true,
  "formallyRegisterWithoutHumanReview": false,
  "model": "@cf/black-forest-labs/flux-2-klein-4b",
  "noAutomaticRetry": true,
  "doNotTriggerAgain": true
}
