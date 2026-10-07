const {
  initializeApp,
  cert,
  getApps,
} = require('firebase-admin/app');

const {
  getMessaging,
} = require('firebase-admin/messaging');

const serviceAccountBase64 =
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!serviceAccountBase64) {
  throw new Error(
    'Falta FIREBASE_SERVICE_ACCOUNT_BASE64.'
  );
}

let serviceAccount;

try {
  const jsonString =
    Buffer.from(
      serviceAccountBase64,
      'base64'
    ).toString('utf8');

  serviceAccount =
    JSON.parse(jsonString);
} catch (error) {
  throw new Error(
    'No fue posible leer las credenciales de Firebase desde Base64.'
  );
}

let firebaseApp;

if (getApps().length === 0) {
  firebaseApp = initializeApp({
    credential:
      cert(serviceAccount),
  });
} else {
  firebaseApp =
    getApps()[0];
}

const firebaseMessaging =
  getMessaging(firebaseApp);

module.exports = {
  firebaseMessaging,
};
