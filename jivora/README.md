# Jivora

**Useful tools. Made simple.**

A fully static toolbox website: 10 working tools, dark/light themes, instant client-side
search, and complete SEO metadata. No backend, no build step, no login or signup —
anywhere.

---

## What's inside

| Area | Details |
| --- | --- |
| Pages | Home, tools directory, 10 tool pages, About, Privacy, Terms, Contact, 404 |
| Live tools | Percentage, Age, CGPA, EMI, GST calculators · QR generator · Word counter · JSON formatter · Password generator · Image compressor |
| Roadmap tools | Listed honestly as “Coming soon” (no broken links, no fake buttons) |
| Themes | Dark ⇄ light, remembered in `localStorage` |
| Search | Global command palette (`Ctrl/⌘ + K` or `/`) plus the home hero search |
| Privacy | All tool processing happens in the browser — nothing is uploaded |
| SEO | Unique titles/descriptions, canonical + Open Graph tags, JSON-LD (WebApplication, FAQPage, BreadcrumbList), `robots.txt`, `sitemap.xml` |
| Analytics | GA4 + Search Console **placeholders only** — nothing fake is hard-coded |

### Structure

```
index.html  about.html  privacy.html  terms.html  contact.html  404.html
tools/            one .html page per tool + index.html (directory)
css/              style.css (design system) · tools.css (tool pages)
js/               config.js · analytics.js · tools-data.js · search.js · main.js
js/tools/         one script per tool (pure client-side logic)
assets/           favicon.svg · og-image.png (you add this, see below)
robots.txt  sitemap.xml  site.webmanifest
```

---

## Owner setup (do this before launch)

### 1. Replace the placeholder domain

Every HTML file, `sitemap.xml` and `robots.txt` use `https://jivora.example`.

```bash
# from the project root (find + sed, or do it by hand)
grep -rl "jivora.example" . | xargs sed -i 's|https://jivora.example|https://your-real-domain.com|g'
```

Also update the `siteUrl` value in **`js/config.js`**.

### 2. Configure analytics & search console — `js/config.js`

```js
window.JIVORA_CONFIG = {
  siteUrl: "https://your-real-domain.com",
  ga4MeasurementId: "",            // e.g. "G-XXXXXXXXXX" — leave "" to load NO analytics
  searchConsoleVerification: "",   // content value from the GSC "HTML tag" method
  contactEmail: "hello@your-domain.com"
};
```

* **GA4:** create a property at analytics.google.com and paste the Measurement ID.
  While it is an empty string, `js/analytics.js` loads nothing at all — no script, no
  cookie, no request. Events are privacy-configured (`anonymize_ip`, no ad signals).
* **Search Console:** add your property → verification method *HTML tag* → copy the
  `content` value. It is injected as a `<meta>` tag on every page automatically.
* **Contact email:** also update the visible `mailto:` links in `contact.html`
  (the page keeps them in sync from config when JavaScript runs).

### 3. Add the social share image

Export a **1200 × 630 PNG** as `assets/og-image.png` (Jivora navy background, logo and
the tagline “Useful tools. Made simple.”). The OG/Twitter tags on every page already
point to it. Until the file exists, social previews will simply show no image.

### 4. Submit the sitemap

Once live, submit `https://your-domain.com/sitemap.xml` in Google Search Console.

---

## Deploying (free static hosting)

The repo is plain files — push it anywhere:

* **GitHub Pages:** Settings → Pages → deploy from branch (`main`, `/ root`).
  Custom domains work via a `CNAME` file.
* **Netlify / Cloudflare Pages:** connect the repo; no build command, publish
  directory `/`.
* **Any other static host:** upload the files as-is.

Local preview (any static server works):

```bash
npx serve .          # or: python3 -m http.server 8080
```

> Note: the tool pages use `.html` URLs (not extensionless routes) precisely so every
> host serves them without rewrite rules.

---

## How the tools stay private

Each tool runs entirely in the browser:

* **Calculators / counters / formatters** — plain JavaScript, no requests.
* **QR codes** — encoded from scratch in `js/tools/qr-code-generator.js` (ISO 18004).
* **Passwords** — generated with `crypto.getRandomValues()`, never stored.
* **Images** — read from disk, re-encoded on an off-screen canvas, downloaded back;
  no upload endpoint exists.

You can verify this by disconnecting from the network: every tool keeps working.

---

## Adding a new tool

1. Create `tools/<slug>.html` by copying an existing tool page (e.g.
   `tools/percentage-calculator.html`) — keep the head metadata, JSON-LD
   (WebApplication + FAQPage + BreadcrumbList), breadcrumb, panel and footer, and make
   sure FAQ text matches the JSON-LD exactly.
2. Add `js/tools/<slug>.js` (IIFE pattern; use `window.JivoraUI` helpers for copy /
   formatting / tracking).
3. Register the tool in **`js/tools-data.js`** with `available: true` — this drives
   search, the directory page and related-tool cards. Use `available: false` for
   roadmap entries (they render as “Coming soon”, never as broken links).
4. Link it from the home page and add its URL to `sitemap.xml`.

### Hard rules the codebase follows

* **No login, signup or account UI anywhere.**
* No fake IDs, fake testimonials, fake stats or fake reviews.
* `available: false` tools are never rendered as links.
* GA4/Search Console values live only in `js/config.js` and default to empty.

---

## License

Site content and code © 2026 Jivora. Add your preferred license file here if you
plan to open-source it.
