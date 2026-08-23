import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error('FCM disabled: FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    return null;
  }

  try {
    const credentials = JSON.parse(raw);
    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(credentials) });
    return firebaseApp;
  } catch (error) {
    console.error('FCM initialization failed:', error);
    return null;
  }
}

export type PushEvent = {
  type: 'patient_created' | 'invoice_created';
  title: string;
  body: string;
  patientId?: string;
  invoiceId?: string;
  notificationId: string;
};

export async function sendPushToTokens(tokens: string[], event: PushEvent) {
  const app = getFirebaseApp();
  if (!app || !tokens.length) return { successCount: 0, failureCount: 0, invalidTokens: [] as string[] };

  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  const response = await app.messaging().sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title: event.title, body: event.body },
    data: {
      type: event.type,
      notificationId: event.notificationId,
      patientId: event.patientId || '',
      invoiceId: event.invoiceId || '',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'rizvi_notifications',
        sound: 'default',
        priority: 'high',
      },
    },
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        invalidTokens.push(uniqueTokens[index]);
      }
      console.error('FCM send failed:', code, result.error?.message);
    }
  });

  return { successCount: response.successCount, failureCount: response.failureCount, invalidTokens };
}

export async function sendPatientCreatedPush(tokens: string[], patientId: string) {
  return sendPushToTokens(tokens, {
    type: 'patient_created',
    title: 'New Patient',
    body: 'A new patient has been created.',
    patientId,
    notificationId: `patient:${patientId}`,
  });
}

export async function sendInvoiceCreatedPush(tokens: string[], invoiceId: string) {
  return sendPushToTokens(tokens, {
    type: 'invoice_created',
    title: 'New Invoice',
    body: 'A new invoice has been created.',
    invoiceId,
    notificationId: `invoice:${invoiceId}`,
  });
}
