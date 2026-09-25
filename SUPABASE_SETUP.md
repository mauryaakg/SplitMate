# Supabase setup for SplitMate Phase 1

Phase 1 adds optional email/password authentication only. It does **not** migrate, upload, read, or delete SplitMate expense data. The existing localStorage mode remains the default fallback.

## 1. Create a Supabase project

1. Open [supabase.com](https://supabase.com/) and create an account.
2. Create a new project in the Supabase dashboard.
3. Choose a project name, a strong database password, and a region.
4. Wait for the project to finish provisioning.

## 2. Find the project URL and public key

In the Supabase dashboard:

1. Open **Project Settings**.
2. Open **API** (sometimes shown as **Data API** or **API Settings** in newer dashboard layouts).
3. Copy:
   - **Project URL**, such as `https://your-project-ref.supabase.co`.
   - The browser-safe **Publishable key** (`sb_publishable_...`) if your project exposes the newer key format.
   - Otherwise, use the legacy **anon public** key shown under Project API keys.

Do not use a secret key in the browser.

## 3. Configure SplitMate

Open `auth.js` and replace the empty configuration near the top:

```js
const CONFIG = window.SPLITMATE_SUPABASE_CONFIG || { url: '', anonKey: '' };
```

with your public project values, for example:

```js
const CONFIG = window.SPLITMATE_SUPABASE_CONFIG || {
  url: 'https://your-project-ref.supabase.co',
  anonKey: 'your-public-publishable-or-anon-key'
};
```

Only the URL and public client key belong in this static GitHub Pages frontend.

## 4. Configure Auth URLs

In Supabase, open **Authentication → URL Configuration** and set:

**Site URL**

```text
https://mauryaakg.github.io/SplitMate/
```

**Additional Redirect URLs**

```text
https://mauryaakg.github.io/SplitMate/
http://localhost:8000/
```

If you test with another local server port, add that exact origin and path too. Keep the trailing slash consistent with the URL you use.

## 5. Configure email/password

Open **Authentication → Providers → Email** and enable email/password authentication. For development, you may use Supabase's built-in email service if available for your project. Email confirmation settings are controlled by the same provider settings.

Phase 1 uses `signUp`, `signInWithPassword`, `getSession`, `onAuthStateChange`, and `signOut` from the Supabase browser client.

## Safe and unsafe values

Safe to include in a browser app:

- Supabase Project URL
- Publishable key (`sb_publishable_...`)
- Legacy `anon` public key, provided RLS protects every future data table

Never commit these to GitHub:

- Supabase secret key (`sb_secret_...`)
- Service-role key
- Database password
- Supabase management/API access tokens
- SMTP passwords or private OAuth client secrets
- Any private signing key

A public key is not a permission bypass. Before cloud data synchronization is implemented, database tables must have carefully reviewed Row Level Security policies.

## Current behavior

- Signed out: SplitMate continues to use localStorage exactly as before.
- Signed in: the browser keeps a persistent Supabase auth session, but no expense or budget data is uploaded in Phase 1.
- Missing configuration: the account panel clearly stays in local-only mode.
- No credentials are included in this repository.
