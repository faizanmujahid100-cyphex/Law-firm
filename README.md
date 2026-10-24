# Amanah Legal

A Next.js 16 legal services application for a Pakistani law office. The app uses **Firebase Authentication, Cloud Firestore and private Firebase Storage**. Next.js server routes enforce record-level access with the Firebase Admin SDK. Public signup creates clients; only a controlled script creates the first administrator, and administrators create team members.

## Firebase project setup

Use project `law-firm-52f3c` or replace the project values in your environment. In the Firebase console:

1. Enable **Authentication → Email/Password** and configure email action templates and authorized domains. Add your Vercel production domain and any preview domains you intend to use.
2. Create the default **Cloud Firestore** database in production mode.
3. Enable **Cloud Storage for Firebase** and confirm the bucket name. The bucket must not be publicly accessible.
4. Deploy the repository’s `firestore.rules`, `storage.rules` and `firestore.indexes.json` using `firebase deploy --only firestore,storage` from an authenticated Firebase CLI. Both rule files deny direct browser access; all application data goes through authenticated server routes.
5. Generate a **new** service account key with Firestore, Authentication and Storage permissions. The credential pasted into the conversation should be revoked and replaced before production use.

Official references: [Firebase email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firestore setup](https://firebase.google.com/docs/firestore/quickstart), and [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies).

## Local development

1. Install Node.js 22 and run `npm install`.
2. Copy `.env.example` to `.env.local`. Enter the Firebase web values from Project settings. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete service account JSON as one quoted line. The file is ignored by Git. The server never uses the service account in client-side code.
3. Generate `DATA_ENCRYPTION_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Back it up in a secret manager; losing it makes encrypted identity numbers unreadable.
4. Run `npm run check:config`, then `npm run db:seed` to create firm settings and editable domicile and tax service templates. The seed creates no clients, applications or payments.
5. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` in your shell, then run `npm run admin:setup`. This script refuses to run after the first administrator exists.
6. Run `npm run dev` and visit `http://localhost:3000`.

## Vercel deployment

1. Import this repository as a Next.js project. The package specifies Node.js 22.x, which [Vercel supports](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
2. Add all variables from `.env.example` in Vercel Project Settings → Environment Variables. Set `APP_URL` to your HTTPS production origin. Put the rotated service account JSON in the **server-only** `FIREBASE_SERVICE_ACCOUNT_JSON` variable and the encryption key in `DATA_ENCRYPTION_KEY`. Do not set either with a `NEXT_PUBLIC_` prefix. Vercel requires the JSON environment variable because ignored local files are not deployed.
3. Enable the Firebase Auth domain and deploy Firestore and Storage rules before admitting clients.
4. Seed services and create the first administrator from a controlled local shell with the production environment values. Never run the first-admin script in a public route.
5. Deploy to Vercel. `prebuild` checks required Firebase variables, project agreement, service account presence and key length. The build fails if these checks do not pass.
6. Test signup, verification email, client login, team invitation, role isolation, document upload/download, task claiming and payment verification against the deployed URL before accepting real records.

Vercel environment variables are set outside source control; changes require a new deployment. See [Vercel’s environment variable documentation](https://vercel.com/docs/environment-variables).

## Security and data model

- Firebase Auth manages passwords and email verification. The server issues HTTP-only, same-site Firebase session cookies after verifying a recent sign-in and checks revocation for protected requests.
- Roles live in Firebase Auth custom claims and Firestore user records. The server requires both to agree. Public signup cannot choose `ADMIN` or `TEAM`.
- Firestore and Storage rules deny direct client access. The server validates ownership and assignment before reading or writing each private record.
- Identity number fields are encrypted with AES-256-GCM before Firestore writes. Private documents use random Storage keys and 60-second signed URLs after authorization.
- Service edits create new version documents; existing applications retain the version they started with. Firestore transactions enforce exclusive task claiming and prevent simultaneous payment verification from exceeding an invoice balance.
- Government filing and online payment gateways are not simulated. Manual payment reports remain pending until an administrator verifies them.

The domicile template is based on [Punjab e-Khidmat guidance](https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/domicile-certificate). Tax templates refer to [FBR registration](https://fbr.gov.pk/categ/register-income-tax/51147/30846/%2071149) and [FBR return filing](https://fbr.gov.pk/categ/file-income-tax-return/51147/80860/71160). Administrators must review requirements by jurisdiction and date.

## Checks and operational limits

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. The workspace could not reach the Firebase APIs, so remote Auth, Firestore and Storage workflows have **not** been exercised against this project. An authenticated deployment smoke test is required before production use. Firestore collection listings with complex filters currently read and filter records on the server; add cursor pagination and indexed queries as the office’s data volume grows. No malware scanning provider or government API is configured. A dependency audit must also complete before production release; the npm audit endpoint was unavailable in this workspace.

Back up Firestore and Storage regularly, test restore procedures, retain the encryption key separately from backups, and review audit logs and Firebase IAM access.
