const { Readable } = require('stream');

// Lazy-load googleapis so a missing install doesn't crash the server
let _google = null;
function getGoogle() {
  if (_google === null) {
    try { _google = require('googleapis').google; } catch { _google = false; }
  }
  return _google || null;
}

function getAuthClient() {
  const g = getGoogle();
  if (!g) return null;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  return new g.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
}

/**
 * Creates a Google Doc from HTML content, optionally shared with a user.
 * Returns { docUrl, docId } or throws if credentials are not configured.
 */
async function createGoogleDoc({ title, htmlContent, shareWithEmail }) {
  const auth = getAuthClient();
  if (!auth) {
    throw new Error(
      'Google Docs not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.'
    );
  }

  const g = getGoogle();
  const drive = g.drive({ version: 'v3', auth });
  const parents = process.env.GOOGLE_DRIVE_FOLDER_ID
    ? [process.env.GOOGLE_DRIVE_FOLDER_ID]
    : undefined;

  const { data: file } = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      ...(parents && { parents })
    },
    media: {
      mimeType: 'text/html',
      body: Readable.from([htmlContent])
    },
    fields: 'id,webViewLink'
  });

  if (shareWithEmail) {
    await drive.permissions.create({
      fileId: file.id,
      sendNotificationEmail: true,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: shareWithEmail
      }
    });
  }

  return { docId: file.id, docUrl: file.webViewLink };
}

module.exports = { createGoogleDoc, isConfigured: () => !!getAuthClient() };
