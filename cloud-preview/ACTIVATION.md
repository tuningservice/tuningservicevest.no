# Privat skytest – avtalt og klargjort 9. november 2026

Godkjent av Bjørn: privat test, berre `vest@tuningservice.no` som testar/admin, føreslått adresse `skytest.tuningservicevest.no`, eksisterande leverandørar, første testbudsjett 10 USD. E-post kan aktiverast til fast servermottakar `vest@tuningservice.no` etter kontroll. Offentleg lansering er ikkje godkjend.

## Gjeldande skystatus 9. november

- Privat testadresse er aktiv: **https://skytest.tuningservicevest.no/**. Den offentlege framsida, GitHub og den delte e-postworkeren er ikkje endra.
- Zero Trust Free er aktivert av kontoeigaren. E-postkode, seks timars økt, HTTPOnly-/binding-cookie og eksakt testar/admin er konfigurerte. Innlogginga er gjennomført av brukaren. HTML, CSS, katalogindeks og API blir omdirigerte til Access utan innlogging.
- Eigen Worker `tuningservicevest-skytest`, D1 `tuningservicevest-chat-test` med EU-jurisdiksjon og stadfesta EEUR-region. Seks apptabellar og migrasjonssporing. Eksisterande servernøklar er lasta direkte til denne Workeren; ingen verdiar i klient, Git eller rapport.
- Arbeidskopien beheld full katalog med 9 911 steg, 6 559 variantar og 66 merke. Manuelt Audi A3-val er testa mot den merkevise skyeksporten.
- Ekte generell AI, BMW-regnr → automatisk effektresultat, Stage 1 → Stage 2, hardwarekontekst og EGR-tilval er testa i nettlesaren. BMW Stage 1: 197→250 HK / 400→520 Nm; Stage 2: 265 HK / 550 Nm. Tal er leverandøroppgitte, ikkje eigne målingar.
- Byte til Audi A3 1.4 TFSi CHPA nullstilte gammalt steg og EGR. AI-en svarte med nye 140→190 HK / 250→310 Nm, Stage 1, og at EGR ikkje var valt.
- E-post er no i `live-test`. Mailjet har stadfesta mottak av eitt oppslagsvarsel, éi tydeleg merkt testførespurnad med berre fiktiv mobil og éin eksplisitt avslutta samtalelogg. Dette er leverandørkvitteringar; mottak i innboksen må kontrollerast av Bjørn.
- Bjørn har deretter stadfesta at både regnr-varselet og førespurnaden med fiktivt mobilnummer har kome fram i innboksen. Pushover er drøfta som tillegg for korte varsel; det er ikkje kopla til og eksisterande Vevsmia-varsling er urørt.
- Eiga samtale utan tilbod vart lukka i nettlesaren. Cloudflare-cron lagde loggen i kø etter **309 sekund (5 minutt og 9 sekund)**, og Mailjet godkjende sendinga. Ingen lokalserver eller open kundetab stod for utløysinga.
- Sluttstatus for desse fire ekte testmeldingane: 1 oppslag, 1 kontakt, 2 samtaleloggar; alle `accepted`, ingen feila/ventande, ingen ny logg utan endra revisjon. Telefonførespurnaden har ikkje oppdikta Reply-To. Heile kronologien blir bevart som vedlegg, medan sjølve e-postteksten er kortare.
- Skyvisninga er kontrollert ved 390×844, med mobil chat, synleg tilbodsknapp og tastaturstyrt minimering. Skjermbilete ligg lokalt i den ignorerte mappa `.chat-preview-tmp/cloud-screens/`. Mellombels mobilviewport er nullstilt.
- Dei fem konfigurerte løyndomsverdiane er samanlikna i minnet mot 136 bygde klientfiler: 0 treff. `.dev.vars` og byggkonfigurasjonen er stadfesta Git-ignorerte; innstillingsfila er ikkje spora.
- 529 automatiserte testar bestått, 0 feila, med simulerte leverandørar. Testserverane krev lokal nettverkstilgang; ei sandkassekøyring utan dette gav EACCES og vart køyrd på nytt med rett tilgang.
- Skytesten fann ein konkret runtimeforskjell: Workerd støttar ikkje `redirect:'error'` som lokal Node-fetch. Skyadapteren brukar no `manual` og avviser 3xx eksplisitt. Han følgjer aldri vidare til ein annan URL med leverandørnøklar. Regresjonstest er lagd til. JWT-verifisering er framleis full og feilar lukka; mellombels diagnostikk er fjerna.
- Workers Paid er ikkje aktivert. Dei kontrollerte førespurnadene fungerer på eksisterande gratisplan; dette dokumenterer ikkje kapasitet ved stor trafikk. AI har varig reservegrense 5 USD, og e-post har 25 forsøk per døgn. Ingen global Cloudflare-fakturasperre er påstått.
- Automatisk aktiv sletting er 30 dagar. Innboks-/Mailjet-kopiar og D1 si attopprettingshistorie må behandlast separat. Skytesten er ikkje ei godkjenning av offentleg lansering.

## Ferdig lokalt

- Separat Worker-entry `worker.mjs`; ingen produksjonsrute, Pages-branch, Git-push eller delt e-postworker er endra.
- Eksisterande oppslag, identifikasjon, effekt-/hardware- og AI-reglar blir gjenbrukte. Full eksport: 9 911 steg, 6 559 variantar, 66 merke. Merkedelane blir lasta komplette med sjekksumkontroll; eit avbrote deloppslag kan ikkje gi falskt eintydig match.
- D1-adapter med versjonskontroll (compare-and-swap) per samtale. Samtalehending og tilhøyrande utkø blir lagra i same atomiske batch. Konflikt gir eit forsøk som kan takast opp att; ingen gamle bildata får skrive over nye.
- Opaque oppslagstoken og normaliserte tekniske registerfelt blir lagra privat med samtalen. Ingen gamle kundejournalar er importerte.
- Varig utkø for kvart oppslag, kontakt og avslutta/inaktiv samtale. Cron kvart minutt, minst 300 sekund utan ny kundeaktivitet. Nye usende loggar blir erstatta av ny revisjon. Tvitydig Mailjet-kvittering blir halden for kontroll, ikkje blindt send på nytt.
- Telefon ELLER e-post, kontakt utan vald modell, full kronologisk logg i vedlegg. Mottakar blir fastsett av serveren. Kvittering seier «registrert og lagd i kø», ikkje at e-posten er levert.
- Access-JWT kontrollerer signatur, utferdar, målgruppe, tid og eksplisitt testar. Alle HTML-, asset-, katalog- og API-ruter krev tilgang. Samtalar er i tillegg knytte til innlogga eigar. Alternative vertnamn blir avviste. Administrator har eigen allowlist.
- Varige rategrenser og AI-reserve på 5 USD for heile testen. Den andre halvparten av 10 USD-ramma er sett av til eventuell Workers-grunnpris. Dette er ikkje ei global Cloudflare-kostnadssperre. Modellen er låst til den kontrollerte `gpt-6-luna`-prisen; forseinka/feila kall held forsiktig reserve. Reell tokenbruk reduserer reservasjonen etter vellukka svar.
- Brytar for e-post i separat admin-API. Startmodus er simulert. Slå-på sender ikkje gammal testhistorikk; utsending av gamle jobbar i feil modus blir undertrykt.
- Automatisk sletting av aktive testloggar og tilhøyrande utkø etter 30 dagar. Mailjet-/innbokskopiar må slettast separat. D1 si attopprettingshistorie kan halde kopiar utover aktiv sletting og må dokumenterast ved skyaktivering.

## Testar og lokal runtime

`node --test test/*.test.mjs` køyrer det eksisterande regresjonssettet og `test/cloud-preview.test.mjs`. Dei nye testane brukar faktisk SQLite med D1 sitt asynkrone kallmønster og simulerte leverandørar. JWT-testen signerer/verifiserer ein eigen lokal RSA-nøkkel; ingen kontonøkkel blir brukt.

Testpakken er dessutan bygd med eksisterande Wrangler 4.131.1 (`deploy --dry-run`, inga publisering) og køyrd med Workerd/Miniflare og lokal D1. Windows si lange filsti gav ei lokal feil; kortare tempsti løyste henne. Kompatibilitetsdato er låst til `2026-09-18`, som den installerte runtime støttar. Ingen pakkar er installerte/oppgraderte.

Lokal fixture-kontroll på `http://127.0.0.1:8799/test/chat/`:

- Heile faste katalogen er tilgjengeleg merkevis. Manuelt BMW → 3-Serie → F3x → 320d 163 HK gav originale 163 HK/380 Nm og Stage 1: 220 HK/440 Nm frå eksporten.
- Tydeleg syntetisk `DEMO01` gjekk automatisk til Audi A3-resultat. Stage 1: 105→142 HK / 250→308 Nm; Stage 2: 150 HK / 340 Nm og syntetisk intercooler-krav.
- EGR-klikk markerte tilvalet, opna chatten og gav eit tydeleg simulert testsvar. Mobilkontakt hadde Stage 2 + EGR + samtalen og registrerte fiktivt telefonnummer med «ingen e-post er send».
- Dette er lokal leverandørsimulering; det er ikkje eit nytt ekte SVV-, AI- eller Mailjet-kall. Eksisterande lokalserver 8791 held fram separat.

`local-fixture-worker.mjs` har berre lokal testinnlogging og simulerte leverandørar. Han er ALDRI entry i den verkelege utrullingsfila. Den verkelege `worker.mjs` avviser uautorisert tilgang og manglande konfigurasjon.

## Historisk aktiveringsrekkjefølgje (før opprettinga)

1. **Brukarsteg:** Cloudflare sitt første Zero Trust Free-oppsett krev betalingsopplysningar, vilkår og fullmakt for eventuell bruk utover gratisgrenser. Gratisalternativet viser 0 USD/månad for inntil 50 brukarar. Ingen betalingsfelt er fylte, ingen vilkår er kryssa av og ingen plan er aktivert av agenten. Dette siste steget blir overlate til kontoeigaren.
2. Eksisterande Wrangler-innlogging er utgått. Forny normal Cloudflare OAuth-innlogging; ikkje be om å sende eit nytt API-token i chatten. Avgrens og kontroller løyva før eventuell autorisering.
3. Opprett Access-app for heile `skytest.tuningservicevest.no`, e-postkode-innlogging og berre `vest@tuningservice.no`. Registrer korrekt teamdomene og app-audience i ignorert konfigurasjon. Inga offentleg bypass-policy.
4. Opprett separat EU-jurisdiksjon D1; migrer berre `0002-cloud-state.sql` (i byggpakka kalla `0001-cloud-state.sql`). Den gamle `0001-journal-draft.sql` er eit historisk schemautkast og skal ikkje brukast som skyadapter.
5. Last servernøklar sikkert frå eksisterande `.dev.vars` til berre denne test-Workeren. Ingen verdiar i chat, klient, Git eller vanlege loggar. Pakka inneheld ingen nøklar eller gamle private journaldata.
6. Kontroller og aktiver isolert Worker med `workers_dev=false`, `preview_urls=false`, `run_worker_first=true`, utan observability av requestinnhald. Set eiga testadresse først etter at innlogging og avvising er verifisert. Ikkje publiser til eksisterande Pages eller produksjonsruta.
7. Mål CPU/minne i faktisk sky. Gratisplanen sin CPU-grense er ikkje dokumentert tilstrekkeleg for matching av større merke. Ved behov kan Workers Paid (5 USD/månad som grunnpris) vurderast innan første testbudsjett; overforbruk er ikkje automatisk godkjent.
8. Først simulert sky-kontroll, deretter få ekte test-e-postar. Kontroller nettlesar lukka, PC avslått, regnr utan treff, lang logg, vidare aktivitet, tilgang utan innlogging og budsjettgrensa. Test at telefon åleine aldri set oppdikta Reply-To.

## Bygg utan publisering

```powershell
node tools/prepare-cloud-catalogue.mjs
node tools/prepare-skytest.mjs
```

Bygg og konfigurasjon ligg Git-ignorert i `.chat-preview-tmp/skytest/`. Den lokale konfigurasjonen har no dei kontrollerte ressurs-ID-ane og Access-metadataa. Byggskriptet bevarer desse og avviser andre vertnamn og usikre konfigurasjonar. Det publiserer aldri på eiga hand. Hovudtesten er den avgrensa kundereisesida; den nyare offentlege produksjonsframsida er ikkje erstatta av ein eldre lokal kopi.
