# CPM Data Analytics

CPM has an Android employee app, a React management dashboard, and a shared
FastAPI/PostgreSQL backend. The apps use live backend data; the employee app
reads device call metadata only after the employee accepts the disclosure and
grants Android call-log permission.

## Local development

- Backend setup, database startup, and admin seeding: see
  [backend/README.md](./backend/README.md).
- Management dashboard: run `npm ci`, set `VITE_API_BASE_URL` in
  `management-web/.env.local`, then run `npm run dev` from `management-web`.
- Android: open the project in Android Studio and run the `app` configuration.
  The debug build defaults to the Android emulator API URL. For a physical
  phone, set `CPM_API_BASE_URL` to the computer's LAN API URL.

## Production preparation

The root [render.yaml](./render.yaml) defines a Singapore-region Render
deployment with a managed PostgreSQL database, FastAPI service, and static
management site. Applying the blueprint creates paid cloud resources; review
Render's current pricing before deploying. It starts with a new, empty
production database. No local employee or call data is copied.

The blueprint runs migrations and creates only the configured admin account.
Set the admin credentials in Render's secret prompts, then add the Firebase
service-account JSON as a Render secret file at
`/etc/secrets/firebase-service-account.json` for manager-triggered sync.

The Android release build requires an HTTPS API URL, `google-services.json`,
and a signing keystore supplied through environment variables. Keep the
keystore and passwords outside source control. The build intentionally refuses
to produce a release artifact until those requirements are met. See
[backend/README.md](./backend/README.md) for the deployment sequence and final
launch checks.
