# `.well-known/assetlinks.json`

Android App Links. This file is how Android decides whether tapping an
`https://` link on this domain should open the FSI Farm Manager app
instead of a browser tab.

The file lives at `public/.well-known/assetlinks.json` and is served
statically, so the live URL is:

```
https://web.fsinnovation.net/.well-known/assetlinks.json
```

No route, no component, no middleware. If that URL ever stops returning
HTTP 200 with `content-type: application/json`, App Links break
silently — the links keep working, they just stop opening the app, and
nothing logs an error.

## On Vercel specifically

This deploys from git, `public/` is the static root, and there is no
`.vercelignore`, so the file ships as-is. Verified locally against a
production build: HTTP 200, `application/json`.

**Android does not follow redirects when it fetches this file.** That is
not a preference, it is how the verifier works — a 301, 302 or 307 is
treated as "no statement found" and the domain simply fails to verify.

That is why this file is served from `web.fsinnovation.net` rather than
the apex. `https://fsinnovation.net/.well-known/assetlinks.json`
currently 307s to `www.`, and Vercel apex→www redirects are configured
at the domain level, where a single path cannot be carved out. If the
apex ever needs to claim the app too, it has to become a real deployment
target rather than a redirect, and serve its own copy of this file.

This directory holds only `assetlinks.json` on purpose. Anything else
placed here is publicly fetchable at `/.well-known/<name>`.

---

## Two things are still outstanding

### 1. The Play App Signing fingerprint is missing

The fingerprint currently in the file is the **upload key**, read from
the signature block of `application-…64023c.aab`:

```
18:2C:56:AE:46:87:FC:93:34:E3:CA:67:29:DF:C9:73:49:59:11:48:F6:16:20:72:00:4B:90:CE:06:F1:DE:27
```

That is the right value for a build installed **directly** from the
`.aab` or an APK built from it — internal sideloads, a device you
`adb install` to.

It is **not** the fingerprint of a build installed from Google Play.
Play App Signing re-signs the app with its own key, so a Play-installed
app presents a different certificate and will not verify against this
file alone.

Get the other one from **Play Console → Test and release → App integrity
→ App signing**, copy the SHA-256 under *App signing key certificate*,
and add it to the array:

```json
"sha256_cert_fingerprints": [
  "18:2C:56:…:DE:27",          // upload key — direct installs
  "<PLAY APP SIGNING SHA-256>"  // Play installs
]
```

Keep both. Google's own guidance is to list every certificate that may
sign a build users can install, and dropping the upload key would break
verification for your own internal test devices.

### 2. The app claims the wrong host

`app.config` currently declares:

```json
"intentFilters": [{
  "action": "VIEW",
  "autoVerify": true,
  "data": [{ "scheme": "https", "host": "fsinnovation.net", "pathPrefix": "/invite" }]
}]
```

But the invite links the backend actually emails are built in
`StaffInviteController` from `config('app.invite_url')`, which is:

```
https://web.fsinnovation.net/invite/accept?token=<raw>
```

Different host, and `/invite/accept` rather than `/invite/<token>`.
`https://fsinnovation.net/invite/anything` currently returns 404 — it
307s to `www.`, which has no such route.

So as things stand, **no invite link a farmer receives is on the domain
the app claims**, and App Links cannot verify no matter where this file
is served from.

The fix is in the mobile app, not here: add `web.fsinnovation.net` to
the intent filter's `data` array. An intent filter takes multiple hosts,
so the existing `fsinnovation.net` entry can stay if the marketing site
is ever given a real `/invite` route — in which case that site needs a
copy of this same file at its own `/.well-known/assetlinks.json`.

---

## Verifying it works

```bash
curl -sI https://web.fsinnovation.net/.well-known/assetlinks.json
```

Wants `HTTP/2 200` and `content-type: application/json`. A 307, a 404 or
an HTML body all mean it is broken.

Google's checker, which is what Android itself effectively runs:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://web.fsinnovation.net&relation=delegate_permission/common.handle_all_urls
```

On a device with the app installed:

```bash
adb shell pm get-app-links com.farmsupportinnovation.fsino
```

`verified` is what you want. `legacy_failure` or `none` means the
fingerprint does not match, which is almost always the Play App Signing
key being absent from this file.
