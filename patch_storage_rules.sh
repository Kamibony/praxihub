cat << 'INNER_EOF' > /tmp/storage.patch
<<<<<<< SEARCH
    match /contracts/{userId}/{fileName} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if false; // WORM compliance
    }
=======
    match /contracts/{userId}/{fileName} {
      allow read: if request.auth != null && (request.auth.uid == userId || request.auth.token.role in ['admin', 'coordinator'] || request.auth.token.impersonatorUid != null);
      allow create: if request.auth != null && (request.auth.uid == userId || request.auth.token.role in ['admin', 'coordinator'] || request.auth.token.impersonatorUid != null);
      allow update, delete: if false; // WORM compliance
    }
>>>>>>> REPLACE
INNER_EOF
