# Android push integration

`pushNotificationService.ts` provides the Firebase Admin sender used by both Android applications.

After a patient or invoice is persisted, call the corresponding helper with the currently registered Android FCM tokens. Tokens must be stored server-side by `/api/push/register-token` and removed when FCM returns `registration-token-not-registered` or `invalid-registration-token`.

Required production environment variable:

`FIREBASE_SERVICE_ACCOUNT_JSON`

The value must be the complete Firebase Admin service-account JSON. Never commit the credential to GitHub or bundle it in either APK.

The sender intentionally uses both `notification` and `data` payloads, high Android priority, and the `rizvi_notifications` channel so Android can display the notification while the application is backgrounded or its process is not running.
