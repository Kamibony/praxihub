# MOBILE ARCHITECTURE AUDIT

## 1. API & Firebase Integration
* **Authentication:** The mobile app directly implements `signInWithEmailAndPassword` via the client-side Firebase Auth SDK. This conflicts with the core architectural directive that authentication across the platform should primarily rely on Magic Links. Additionally, Firebase configuration keys (including `apiKey`) are hardcoded directly in `App.tsx` instead of being injected via environment variables.
* **Data Flow & Backend Integration:** The app writes directly to the Firestore `placements` collection via `addDoc` and uploads files directly to Firebase Storage. While the document creation triggers a backend Cloud Function (setting `status: "ANALYZING"`), this direct database access from the client bypasses unified backend validation endpoints and relies heavily on client-side logic.
* **Localization:** There is a critical violation of system constraints. The app contains a mix of Slovak and Czech strings (e.g., "Prihlásiť sa", "Vyfotiť zmluvu", "Nahrát novou smlouvu"). System requirements dictate strict localization to the Czech language (cs-CZ).

## 2. Offline & State Management
* **Network Degradation:** The application currently lacks offline support or graceful degradation. Network requests (like file uploads and Firestore writes) use basic try/catch blocks. If a network failure occurs, the app merely displays an alert without any retry mechanisms, local queueing, or background sync capabilities.
* **State Management & Caching:** State is managed purely via local React `useState` hooks. There is no robust global state manager (like the unified `AuthContext` used in the web app) or local caching strategy.
* **Sensitive Data Storage:** While no explicit caching of student data is implemented, images captured via `expo-image-picker` are temporarily stored on the device's local file system before upload without explicit encryption, which could pose a risk if device-level encryption is bypassed.

## 3. Dependency & Build Posture
* **Dependencies:** The app is built on Expo (~52.0.28) and React Native (0.76.6).
* **Styling Architecture:** The `metro.config.js` is configured to use NativeWind (`withNativeWind`), but `App.tsx` relies entirely on standard React Native `StyleSheet.create` for styling, indicating an incomplete or inconsistent adoption of Tailwind CSS for the mobile platform.
* **Build & Deployment Gaps:**
  * The absence of environment variable management (e.g., `dotenv` or Expo secrets) is a glaring gap for production deployments. Hardcoded keys in source control prevent secure and flexible staging/production builds.
  * The current state of the application is a monolithic MVP in a single `App.tsx` file. The lack of folder structure (e.g., components, screens, services) will severely hinder scalability and smooth app store deployment.
  * The monorepo setup for the mobile app seems rudimentary and isolated, not fully leveraging shared typed interfaces or business logic from the broader workspace.

## Architectural Recommendations
1. **Security & Config:** Remove hardcoded Firebase credentials from `App.tsx` immediately and implement environment variables using `.env` files and `expo-env` or similar mechanisms.
2. **Authentication:** Migrate from password-based authentication to Magic Links to align with the core web platform's auth flow.
3. **Backend Abstraction:** Instead of direct client-to-database writes, encapsulate business logic in Firebase Cloud Functions or shared backend services.
4. **Offline Resilience:** Implement robust offline queues and retry mechanisms (e.g., using `react-native-offline` or TanStack Query) to handle intermittent connectivity gracefully.
5. **Localization:** Audit and rewrite all UI strings to strictly adhere to the Czech (cs-CZ) localization mandate.
6. **Code Structure:** Refactor the monolithic `App.tsx` into a modular architecture (Screens, Components, Services) and fully integrate NativeWind if Tailwind CSS is the chosen design system.