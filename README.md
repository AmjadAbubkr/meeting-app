# Meeting App

React Native CLI Android app for meeting recording, transcription, report generation, and history.

## API Keys

API keys for Groq and Gemini are entered in-app on first launch (or in Settings). They are NOT build-time environment variables — do not set `GROQ_API_KEY` or `GEMINI_API_KEY` as GitHub secrets for the build. Keys are stored securely in the device keychain.

## GitHub Actions

The workflow at `.github/workflows/build.yml` builds both:

- `app-release.apk`
- `app-release.aab`

Required GitHub secrets:

- `KEYSTORE_FILE` as base64-encoded keystore
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

The workflow expects the Android project to live in `android/` and a release signing config to read those values during Gradle release builds.
