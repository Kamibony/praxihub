#!/bin/bash
npx firebase emulators:start --project demo-project --only firestore,auth,functions,storage &
FIREBASE_PID=$!
sleep 15
cd apps/web && NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=localhost:8080 ../../node_modules/.bin/next dev -p 3000 &
NEXT_PID=$!
sleep 15
cd ../../
npx playwright test tests/e2e/live-portfolio.spec.ts
kill $FIREBASE_PID
kill $NEXT_PID
