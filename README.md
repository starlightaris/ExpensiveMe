# ExpensiveMe

How expensive am I, really? A private, offline expense tracker that installs on your phone like an app.

- **Lifestyle cost vs out of pocket.** Mark an expense as *covered by someone else* and the dashboard shows what your lifestyle costs, what you actually paid, and who covered the rest.
- **Your portion only.** Enter just your share. On Food expenses, add a service charge (default 10%) with one tap, or ignore it.
- **Built-in calculator.** The amount field is a calculator keypad (`850+400×2`), and a full calculator sits in the header.
- **Private.** No backend, no account, no network calls. Data lives in your browser's IndexedDB. A strict Content Security Policy is applied to the production build.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm run icons      # regenerate app icons in public/ from design/logo.jpg (needs Python + Pillow)
```

Stack: Vite, React, TypeScript, Tailwind CSS v4, Dexie (IndexedDB), vite-plugin-pwa.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml` and publishes the site at `https://<user>.github.io/<repo>/`.

The build uses a relative base path, so it works under any repository name.

## Install on your phone

Open the site on your phone, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**

From then on, use the installed app only. It has its own storage, separate from the browser tab.

## Your data

- It is stored only on the device, inside the app.
- **Settings → Export backup** saves a JSON file. **Import backup** merges one back in (same records are updated, not duplicated). Use these to back up and to move to a new phone.
- Clearing the browser's or app's site data deletes your records. Export now and then.
