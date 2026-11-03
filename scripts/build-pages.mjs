// Generates plain HTML for GitHub Pages. Edit templates/ and data/tilbod.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const data = JSON.parse(await read('data/tilbod.json'));
const home = await read('index.html');
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (value) => value === null ? 'Etter avtale' : `${new Intl.NumberFormat('nn-NO').format(value)} kr`;
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
  ['utleige', 'Utleige', 'Utleige av diagnoseutstyr og spesialverktøy', 'Spør om å leige Launch X431 PRO3S+ SmartLink med Heavy Duty-utstyr. Få stadfesta dekning, pris og tilgjenge for køyretøyet ditt.']
]) {
  let content = await read(`templates/${slug}.html`);
  const replacements = {
    reiseTekst: escape(data.diagnose.reiseTekst), mvaTekst: escape(data.diagnose.mvaTekst),
    feilsokingPris: escape(money(data.diagnose.prisar.find(item => item.id === 'feilsoking').pris)),
    prisar: data.diagnose.prisar.map((item) => `<article class="price-row"><div><h3>${escape(item.namn)}</h3><p>${escape(item.omfang)}</p></div><p class="price-value">${escape(money(item.pris))}</p></article>`).join('\n'),
    utstyr: data.utstyr.map((item) => `<article class="equipment-card" id="${escape(item.id)}">
      ${item.bilete ? `<img class="equipment-image" src="${escape(item.bilete)}" alt="${escape(item.bileteAlt)}" loading="lazy" />` : ''}
      <div class="equipment-copy"><p class="eyebrow">Diagnoseutstyr</p><h3>${escape(item.namn)}</h3><p class="equipment-addon">${escape(item.tillegg)}</p><p>${escape(item.skildring)}</p><p>Oppgi køyretøy og ønskt leigeperiode, så får du stadfesta dekning, pris og tilgjenge.</p><p class="equipment-price">${escape(item.prisTekst)}</p><a class="btn-primary" href="/?emne=Utleige&amp;utstyr=${encodeURIComponent(item.namn)}#contact">Spør om leige</a></div>
    </article>`).join('\n')
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
  <link rel="stylesheet" href="/css/style.css" />
  <script src="/js/contact-tracking.js" defer></script>
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
