// Generates plain HTML for GitHub Pages. Edit templates/ and data/tilbod.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const data = JSON.parse(await read('data/tilbod.json'));
const styleVersion = createHash('sha256').update(await read('css/style.css')).digest('hex').slice(0,12);
const contextVersion = createHash('sha256').update(await read('js/contact-context.js')).digest('hex').slice(0,12);
const homeSource = await read('index.html');
const home = homeSource.replace(/css\/style\.css\?v=[a-f0-9]+/g, `css/style.css?v=${styleVersion}`)
  .replace(/js\/contact-context\.js(?:\?v=[a-f0-9]+)?/g, `js/contact-context.js?v=${contextVersion}`);
if (home !== homeSource) await writeFile(new URL('index.html',root),home);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (value) => value === null ? 'Etter avtale' : `${new Intl.NumberFormat('nn-NO').format(value)} kr`;
const paragraph = text => text ? `<p>${escape(text)}</p>` : '';
const list = items => items?.length ? `<ul>${items.map(text=>`<li>${escape(text)}</li>`).join('')}</ul>` : '';
const contactLink = (emne,utstyr) => `/?${new URLSearchParams({emne,...(utstyr?{utstyr}:{})}).toString().replaceAll('&','&amp;')}#contact`;
const equipment = item => {
  const price = item.prisar
    ? `<dl class="equipment-rates">${[['Døgn','dogn'],['Helg','helg'],['Depositum','depositum']].map(([label,key])=>`<div><dt>${label}</dt><dd>${escape(money(item.prisar[key]))}</dd></div>`).join('')}</dl>`
    : `<p class="equipment-price">${escape(item.prisTekst)}</p>`;
  const details = paragraph(item.skildring)+(item.detaljar||[]).map(section=>`<h4>${escape(section.overskrift)}</h4>${paragraph(section.tekst)}${list(section.punkt)}${paragraph(section.ettertekst)}`).join('')
    +(item.relatert?`<p><a class="text-link" href="#${escape(item.relatert.id)}">${escape(item.relatert.tekst)}</a></p>`:'')
    +(item.video?`<p><a class="text-link" href="${escape(item.video.url)}">${escape(item.video.tekst)}</a></p>`:'')
    +(item.fellesVilkar?`<h4>Praktisk om leiga</h4>${list(data.utleige.vilkar)}`:'');
  const service=item.lagerbyte;
  return `<article class="equipment-card" id="${escape(item.id)}" aria-labelledby="${escape(item.id)}-tittel">
      ${item.bilete?`<div class="equipment-media"><img class="equipment-image" src="${escape(item.bilete)}" width="${item.bileteBreidd}" height="${item.bileteHogd}" alt="${escape(item.bileteAlt)}" loading="lazy" decoding="async" /></div>`:''}
      <div class="equipment-copy"><p class="eyebrow">${escape(item.kategori)}</p><h3 id="${escape(item.id)}-tittel">${escape(item.namn)}</h3>${item.tillegg?`<p class="equipment-addon">${escape(item.tillegg)}</p>`:''}${paragraph(item.korttekst||item.skildring)}${price}<a class="btn-primary" href="${contactLink('Utleige',item.namn)}">Spør om leige<span class="visually-hidden"> av ${escape(item.namn)}</span></a></div>
      <details class="equipment-details"><summary>Les meir<span class="visually-hidden"> om ${escape(item.namn)}</span></summary><div class="equipment-details-content">${details}</div></details>
      ${service?`<aside class="equipment-service" aria-labelledby="${escape(item.id)}-hjelp"><div><h4 id="${escape(item.id)}-hjelp">${escape(service.overskrift)}</h4><p>${escape(service.tekst)} Arbeidet kostar <strong>${escape(money(service.pris))}</strong>. ${escape(service.ettertekst)}</p></div><a class="btn-outline" href="${contactLink(service.emne)}">${escape(service.knapp)}</a></aside>`:''}
    </article>`;
};
const footer = home.match(/  <footer class="footer">[\s\S]*?<\/footer>/)[0];
const nav = (active) => `<header class="subpage-header">
    <nav class="navbar" aria-label="Hovudmeny">
      <div class="logo"><a href="/"><img src="/img/logo-transparent.png" alt="Tuningservice Vest logo" width="1902" height="434" /></a></div>
      <ul class="nav-links">
        ${[['/','Heim'],['/#services','Tenester'],['/diagnose/','Diagnose'],['/utleige/','Utleige'],['https://adbluehjelp.no/','AdBlue'],['https://maskindiagnose.no/','Maskindiagnose'],['/#about','Om oss'],['/#contact','Kontakt']].map(([href,label]) => `<li><a href="${href}"${label === active ? ' class="active" aria-current="page"' : ''}>${label}</a></li>`).join('\n        ')}
      </ul>
    </nav>
  </header>`;
for (const [slug, label, title, description] of [
  ['diagnose', 'Diagnose', 'Bildiagnose – personbil, lastebil, Webasto og Eberspächer', 'Mobil diagnose og feilsøking hos deg på Vestlandet. Sjå prisar og få hjelp med personbil, varebil, lastebil, anleggsmaskin og dieselvarmar.'],
  ['utleige', 'Utleige', 'Utleige av diagnoseutstyr og spesialverktøy', 'Leig Launch-diagnoseutstyr, 78 mm Gen 2-hjullagerverktøy eller universal hjullagerpresse. Sjå leigeprisar og spør om utstyret passar bilen din.']
]) {
  let content = await read(`templates/${slug}.html`);
  const replacements = {
    reiseTekst: escape(data.diagnose.reiseTekst), mvaTekst: escape(data.diagnose.mvaTekst),
    feilsokingPris: escape(money(data.diagnose.prisar.find(item => item.id === 'feilsoking').pris)),
    prisar: data.diagnose.prisar.map((item) => `<article class="price-row"><div><h3>${escape(item.namn)}</h3><p>${escape(item.omfang)}</p></div><p class="price-value">${escape(money(item.pris))}</p></article>`).join('\n'),
    utstyr: data.utstyr.map(equipment).join('\n')
  };
  content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key]);
  const html = `<!DOCTYPE html>
<html lang="nn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(title)} | Tuningservice Vest</title>
  <meta name="description" content="${escape(description)}" />
  <link rel="canonical" href="https://tuningservicevest.no/${slug}/" />
  <meta property="og:title" content="${escape(title)} | Tuningservice Vest" />
  <meta property="og:description" content="${escape(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tuningservicevest.no/${slug}/" />
  <meta property="og:image" content="https://tuningservicevest.no/img/hero-bilde.jpg" />
  <meta property="og:locale" content="nn_NO" />
  <meta property="og:site_name" content="Tuningservice Vest" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/style.css?v=${styleVersion}" />
  <script src="/js/contact-tracking.js" defer></script>
  <link rel="stylesheet" href="/css/assistant-production.css" />
  <script type="module" src="/js/statistics-consent.mjs"></script>
</head>
<body>
  <a class="skip-link" href="#innhald">Hopp til innhaldet</a>
  ${nav(label)}
${content}
${footer}
</body>
</html>
`;
  await mkdir(new URL(`${slug}/`, root), {recursive:true});
  await writeFile(new URL(`${slug}/index.html`, root), html);
  console.log(`Generated /${slug}/`);
}
