# Drift av assistenten

Eigar: BCS Sylte, org.nr. 938299978. Mottakar: vest@tuningservice.no.
Offentleg lansering godkjend av eigaren i chat 10. november 2026.

Framsida blir publisert av det eksisterande Cloudflare Pages-prosjektet frå main.
Assistentens separate Worker eig berre /api/assistant/* på tuningservicevest.no.
Eksisterande /api/contact og den delte mail-workeren er uendra.

## Vidare oppdateringar

Køyr først `node scripts/build-pages.mjs` i denne produksjonskjelda.
Køyr `node tools/build-assistant-assets.mjs` før ei backend-oppdatering.
Køyr deretter Wrangler med `deploy --config production/wrangler.production.json`.
Ingen nøklar skal i Git. Serverhemmelegheitene er lagra på Cloudflare-workeren.
Den opphavlege utviklingskopien og lokal .dev.vars er separate frå denne kjelda.

## Kontroll og e-post

Privat administrasjon: https://skytest.tuningservicevest.no/production-admin/
Cloudflare Access krev vest@tuningservice.no. Besøkande kan ikkje få administratortilgang.
Søk/les loggar og kontroller leveringsstatus. `needs-review` tyder at Mailjet-mottaket
er uvisst: ikkje send blindt på nytt. Avstem mot Mailjet før eventuell manuell sending.
Kontakt blir stadfesta som registrert i varig kø, ikkje som lese av Bjørn.
Mottakar er fastsett på serveren; ingen oppdikta Reply-To ved berre mobilnummer.

Bruksvarsel ved regnr-forsøk og samtaleloggar ved avslutting eller etter fem minutt
blir behandla av serveren. Cron kvart minutt gir normal behandling etter fem–seks
minutt, ikkje ei garantert levering på sekundet. Ny aktivitet gir ein ny revisjon.
Appen avgrensar e-post til 100 leveringsforsøk per UTC-døgn; køen held fram seinare.
Mailjet-kvotar og eventuell leverandørstans kan gi ytterlegare ventetid.

AI har eit varig, forsiktig tak på 5 USD per UTC-kalendermånad for denne appen.
Dette er ikkje eit tak for andre OpenAI-prosjekt eller Cloudflare/Mailjet-rekninga.
Oppslag og kontakt fungerer vidare når AI-reserven er brukt.
Robotvern, signert åttetimarsøkt og rategrenser per økt/IP er aktiverte.

## Personvern og rutine

Kundeinformasjon: /personvern/. Appdata og utkø blir sletta 30 dagar etter siste
lagra aktivitet. EU-D1 er ikkje eit løfte om at alle leverandørar behandlar alt i EØS.
Attoppretting kan krevje at slettingar blir gjentekne; D1 har separat gjenopprettingsvindauge.

Bjørn må handtere e-postkopiane separat: slett bruksloggar utan kontakt etter 30 dagar;
kontaktførespurnader medan saka varer og normalt inntil seks månader etter avslutting.
Les leveringsfeil og kundeavklaringar jamleg i starten. Rett opp dokumenterte
katalogfeil gjennom kontrollerte reglar, ikkje automatisk sjølvlæring frå fritekst.
Innsyn/sletting blir handtert via vest@tuningservice.no og den private journalen.
Leverandøravtalar og eventuell tilgang utanfor EØS må haldast oppdaterte av føretaket.

## Rask tilbakeføring

Framsida før lansering: commit 1e3b28f22f4996d2bb41b9245ebc90ef6d8c96e6.
Bruk Pages si gjenoppretting av førre vellukka produksjonsutrulling. Ikkje nullstill
main med force-push. Ved berre assistentfeil kan ASSISTANT_ENABLED setjast til false
og Worker rullast ut att; ring/e-post i botnseksjonen fungerer utan assistenten.
Behald den private Access-ruta og D1-journalen. Ikkje slett databasen ved tilbakeføring.
