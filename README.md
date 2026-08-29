# Tuningservice Vest

Statisk nettside for `tuningservicevest.no`.

## Struktur

- `index.html`
- `css/style.css`
- `js/contact-form.js`
- `functions/api/contact.js`
- `img/`
- `CNAME`
- `robots.txt`
- `sitemap.xml`

## Kontaktskjema

Skjemaet er klargjort for same sentrale arkitektur som Vevsmia:

`/api/contact` → Cloudflare Pages Function → privat `MAIL_WORKER`-binding → Mailjet.

Før greina kan publiserast må dette vere ferdig i både Production og Preview:

- byt `__TURNSTILE_SITE_KEY__` i `index.html` med offentleg nøkkel frå ein eigen Turnstile-widget for TSV
- set `SITE_ID=tuningservicevest-no`
- set `ALLOWED_HOSTNAMES` til dei eksakte vertsnamna som skal godkjennast
- set `TURNSTILE_SECRET_KEY` som secret
- bind `MAIL_WORKER` til rett produksjons-/staging-worker
- legg `tuningservicevest-no` inn i mail-workeren si tenantliste med mottakar `vest@tuningservice.no`
- test innsending, e-postlevering og Reply-To ende til ende

Ikkje merge denne greina til GitHub Pages-produksjon før Cloudflare Pages og mail-workeren er konfigurert. GitHub Pages kan ikkje køyre `functions/api/contact.js`.
