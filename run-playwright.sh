#!/bin/bash
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-project"
export NEXT_PUBLIC_FIREBASE_API_KEY="demo-api-key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="demo-project.firebaseapp.com"
export NEXT_PUBLIC_USE_FIREBASE_EMULATOR="true"
export NEXT_PUBLIC_FIREBASE_EMULATOR_HOST="127.0.0.1:8080"
export NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"

npx playwright test "$@"
