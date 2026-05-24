#!/bin/bash
kill $(lsof -t -i :3000) 2>/dev/null || true
kill $(lsof -t -i :4000) 2>/dev/null || true
kill $(lsof -t -i :5001) 2>/dev/null || true
kill $(lsof -t -i :8080) 2>/dev/null || true
kill $(lsof -t -i :9099) 2>/dev/null || true
kill $(lsof -t -i :9199) 2>/dev/null || true
mkdir -p test-results

export NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-project"
export NEXT_PUBLIC_FIREBASE_API_KEY="demo-api-key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="demo-project.firebaseapp.com"
export NEXT_PUBLIC_USE_FIREBASE_EMULATOR="true"
export NEXT_PUBLIC_FIREBASE_EMULATOR_HOST="127.0.0.1:8080"
export NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"

npx playwright test "$@"
