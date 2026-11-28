# CPM Common Backend

The FastAPI service and PostgreSQL database are shared by CPM Employee and CPM
Management. The API stores original uploads in Bronze, cleans/deduplicates calls
into Silver, and refreshes daily Gold aggregates after uploads.
Daily aggregates and date-only report filters use the India business timezone
(`Asia/Kolkata`); stored call timestamps are normalized to UTC.

## Run locally

1. If `.env` does not exist, copy `.env.example` to `.env`. Set unique values
   for `POSTGRES_PASSWORD`, `CPM_DB_PASSWORD`, `DATABASE_URL`, and
   `JWT_SECRET_KEY`. The password in `DATABASE_URL` must match
   `CPM_DB_PASSWORD`.
2. Set `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD` in `.env`.
3. From this `backend` directory, start Docker:

   ```powershell
   docker compose up --build -d
   ```

   PostgreSQL initializes `cpm_db` and the `cpm_user` role on the first start.
   The API container runs `alembic upgrade head`, creates the configured admin
   if it does not exist, then starts Uvicorn. The seed is safe to repeat and
   creates no sample employees or call data.
4. Check `http://localhost:8000/health` and open
   `http://localhost:8000/docs`.

The API listens on port `8000`. PostgreSQL is available to database tools at
`localhost:5432`; see [DB_SETUP.md](./DB_SETUP.md).

## Roles and endpoint groups

- `admin`: manage employees and manager accounts, read all data, rebuild Gold.
- `manager`: read all employees, calls, customers, reports, and sync status.
- `employee`: register their own phone and review its consent and permission
  status. Employees cannot start syncs.
- Any signed-in user can change their own password through
  `POST /api/auth/change-password` by providing the current password and a new
  password. The new password must be at least 8 characters and no more than 72
  UTF-8 bytes. The Management web app and Employee Android app both expose this
  action in account security/settings. `ADMIN_PASSWORD` is only used when
  initially seeding the administrator; changing a password updates the database
  and does not change the seed setting.
- A new employee login can be created with `username` and `password` in
  `POST /api/employees`; an admin can create manager logins with
  `POST /api/auth/users`.
- All management endpoints use a bearer token from `POST /api/auth/login`.
- API routes are under `/api`; `/health` and `/docs` remain at the root.

Call-log upload is started by management for a registered device. The backend
sends a data-only Firebase Cloud Messaging command containing the device ID
and a one-time request ID; no call information is included in the push. The
phone reads call metadata only after the employee has opted in and granted
Android permission, then posts the result for that specific management-started
sync. Raw calls are retained unchanged in Bronze and processed into Silver and
Gold.

## Management-initiated background sync

1. Create a Firebase project and register the Android app with package name
   `com.cpm.employee`. Download its `google-services.json` into
   `app/google-services.json`.
2. Enable Firebase Cloud Messaging and create a service-account key for the
   backend. Keep the key private; put it at
   `backend/secrets/firebase-service-account.json` and set
   `FIREBASE_SERVICE_ACCOUNT_FILE=/run/secrets/firebase-service-account.json`
   in `backend/.env`. The secrets folder is mounted read-only into the API
   container and its JSON files are ignored by Git.
3. Rebuild the API and Android app. Each employee signs in once, accepts the
   call-log notice, and grants Android permission. Sign-in registers that
   phone for management sync.
4. In CPM Management, open **Sync Status** and select **Start sync** for a
   registered employee device. The phone must be online and not force-stopped.
   Android may defer background work under battery or network restrictions.
5. Refresh the page to see the result. A phone without consent or permission
   reports a failed sync; management cannot override the employee's consent.

The employee app has no **Sync now** control. FCM tokens are used only to
deliver sync commands; the API accepts a result only when its device token and
one-time request ID match the active management command.

## Switch CPM Management to the API

Create `management-web/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
```

Restart Vite after changing environment variables. The Management app always
uses the backend and requires a valid username/password.

## Switch CPM Employee to the API

`app/src/main/java/com/cpm/employee/data/ApiService.kt` provides login and
device registration. Employee call history and activity are read from the
device only after the employee explicitly opts in and grants Android's
`READ_CALL_LOG` permission. Only records dated after that employee's opt-in are
shown and sent when management starts a sync.
The upload contains phone number, call type/status, timestamp, and duration;
it does not read call audio or contact names. Each employee must have an active
employee login created by an admin before signing in to the Android app.

- Android Emulator default: the generated `CPM_API_BASE_URL` is
  `http://10.0.2.2:8000/api`.
- For a physical phone, set `CPM_API_BASE_URL` in the developer's local
  `gradle.properties` to `http://<computer-LAN-IP>:8000/api`, and allow port
  `8000` through the development firewall.
- The `INTERNET` permission is present. Cleartext HTTP is enabled only for the
  Android debug build; production should use HTTPS.
- Android login uses the employee username/password configured by an admin.
- Call-log permission is requested only after the in-app disclosure is accepted.
  Denial prevents reading and uploading; employees can also turn off consent or
  revoke permission in Android settings. Only management can initiate a sync.
- Google Play restricts call-log permissions. Confirm eligibility and the
  current Play policy before publishing; the included permission flow is not a
  guarantee of Play approval.

The employee app reads local device call history only after in-app consent and
Android call-log permission are granted.

## Prepare a managed-cloud production deployment

The root `render.yaml` defines a Render Blueprint for an always-on API service,
a managed PostgreSQL 16 database, and the Management static site in Singapore.
The API uses the database's private connection, requires TLS for PostgreSQL,
disables public API docs, and limits CORS to the generated Management site.
The Management build receives the API's HTTPS hostname from Render. The
database is new and empty; this setup does not migrate the local database.

Before deploying:

1. Review Render's current prices and choose whether the proposed plans meet
   the business availability and recovery requirements. Applying the Blueprint
   creates paid resources; this repository does not create them automatically.
2. The workspace must be connected to a private Git repository before Render
   can build from it. Do not commit `.env` files, Firebase service-account
   files, `google-services.json`, or Android signing keys.
3. During initial Blueprint setup, provide a unique `ADMIN_USERNAME` and a
   strong `ADMIN_PASSWORD` in the secret prompts. The pre-deploy command runs
   migrations and creates that admin only; it creates no sample employees or
   calls.
4. Upload the Firebase service-account JSON in the API service's secret files
   as `firebase-service-account.json`. The Blueprint points
   `FIREBASE_SERVICE_ACCOUNT_FILE` to `/etc/secrets/firebase-service-account.json`.
5. After deployment, verify `/health`, sign in to Management, create employee
   accounts, and test registration and manager-triggered sync with an opted-in
   phone. Confirm database backups and restore procedures before using real
   business data.

The Blueprint uses the default generated Render domains. If you add a custom
Management domain, update `CORS_ORIGINS` to that exact HTTPS origin. If the
API service domain changes, update the Management service's
`VITE_API_BASE_URL` and the static site's `Content-Security-Policy`
`connect-src`, then redeploy it.

## Build a signed internal Android release

The release build reads these environment variables without writing their
values to the project:

- `CPM_API_BASE_URL` — the deployed HTTPS API origin, optionally ending in
  `/api`.
- `CPM_RELEASE_STORE_FILE` — path to the company's signing keystore.
- `CPM_RELEASE_STORE_PASSWORD`
- `CPM_RELEASE_KEY_ALIAS`
- `CPM_RELEASE_KEY_PASSWORD`

Keep the keystore backed up in an access-controlled location. Losing it can
prevent publishing app updates; committing it or its passwords exposes the
company app identity. The build also requires the production
`app/google-services.json`. With the environment configured, build with
`.\gradlew.bat :app:assembleRelease`; distribute only the signed release APK
through the company's approved internal channel. Do not distribute the debug
APK to employees.

## Business launch gates

- Confirm employee consent wording, lawful basis, retention/deletion policy,
  employee access controls, and local legal requirements for call metadata.
- Test employee login, opt-in and permission denial, sync failure/retry,
  password changes, manager permissions, reports, and account deactivation
  using production-like accounts.
- Verify cloud backups, recovery, monitoring, incident contacts, and account
  offboarding. Do not use the system for real employee data until these checks
  are complete.
