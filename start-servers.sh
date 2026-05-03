#!/bin/bash
npx firebase emulators:start --project demo-project --only firestore,auth,functions,storage > firebase.log 2>&1 &
FIREBASE_PID=$!
sleep 15
cd apps/web && NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=localhost:8080 ../../node_modules/.bin/next dev -p 3000 > next.log 2>&1 &
NEXT_PID=$!
sleep 15
echo "Servers started."
