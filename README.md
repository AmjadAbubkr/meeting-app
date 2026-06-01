# Meeting App

React Native CLI Android app for meeting recording, transcription, report generation, and history.

## GitHub Actions

The workflow at `.github/workflows/build.yml` builds both:

- `app-release.apk`
- `app-release.aab`

Required GitHub secrets:

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `KEYSTORE_FILE` as base64-encoded keystore
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

The workflow expects the Android project to live in `android/` and a release signing config to read those values during Gradle release builds.
