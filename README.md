# HEMMET – levelingresan

Guildens sida inför WoW Forever: hela guilden på en tavla, dag för dag, med kronor,
achievements, statistik, topplistor, gruppsök och armory. All data kommer från Blizzards API.
Tills HEMMET finns i spelet testas allt mot hardcore-guilden Frienship på Stitches.

Release i EU: **5 november 2026 kl 00:00 svensk tid** (4 nov 15:00 PST). Nedräkningen i heron räknar mot det.

## Kör den lokalt

Dubbelklicka `scripts/lokal-server.bat`, eller:

```bash
python scripts/serve.py
```

Öppna http://localhost:5173 (http, inte https). Servern skickar "no-cache", så en ombyggd sida syns direkt.

## Så hänger det ihop

```
fetch_hemmet.py  →  data/hc/          (Blizzards API, var 30:e minut)
build_hemmet.py  →  hemmet/index.html (mall + app.js + datan inbakad)
build_dist.py    →  dist/             (det som laddas upp)
```

| Fil | Vad den gör |
|---|---|
| `hemmet/hemmet.template.html` | Sidans HTML och CSS |
| `hemmet/app.js` | Allt beteende: tavlan, tidslinjen, kronor, achievements, statistik, topplistor, gruppsök, armory |
| `hemmet/index.html` | Byggd sida (skrivs över vid varje bygge, redigera inte) |
| `hemmet/ach/` | Spelets grafik: achievement-ramar, ikoner, zonbilder, ögat, stenen, bannern, lådan |
| `hemmet/renders/` | Helkroppsbilder för dem som står på en pall (byggs ur `data/hc/renders/`) |
| `scripts/fetch_hemmet.py` | Hämtar roster, profiler, gear, rykten, porträtt och pallbilder, och loggar händelser |
| `scripts/build_hemmet.py` | Bygger sidan, spritarna och renderar 3D-modellerna |
| `scripts/render_model.py` | Ritar en glTF-modell till en bild (ren numpy, inget GL) |
| `scripts/build_dist.py` | Samlar sidan i `dist/` för webbhotellet |
| `scripts/build_demo.py` | Bygger förhandsvisningen med påhittad historik i `DEMO/` |
| `scripts/hamta-frienship.bat` | Det Windows schemaläggare kör var 30:e minut (hämta + bygg) |
| `scripts/serve.py`, `lokal-server.bat` | Lokal server på port 5173 |
| `scripts/bnet_probe.py` | Testar vad Blizzards API svarar på |
| `data/hc/` | Frienships data: `members.json`, en snapshot per dag, `events.jsonl`, `state.json` |

Kräver `BNET_ID` och `BNET_SECRET` i `.env`, och Pillow + numpy (`pip install pillow numpy`) för byggsteget.

`hemmet/typo.html` och `hemmet/siffror.html` är testsidor från typsnittsvalet. De laddas inte upp och kan tas bort.

## Datan

**Historiken.** Varje körning skriver över dagens snapshot, så det blir en per kalenderdag. Tidslinjen
dyker upp när det finns två dagar. Börjar mätningen på releasedagen räknas första dagens levels från 1 (`FROM_START`);
annars är första snapshoten bara utgångsläge.

**Tidslinjen** följer händelserna: tavlan visar varje karaktärs level vid exakt tidpunkt (dingen som den hämtning
som såg den), och reglaget går i halvtimmar med klockslag. Utan dings faller den tillbaka på dagens ögonblicksbild.
Med `FROM_START` börjar tidslinjen vid releasen 00:00 med alla på level 1 i Elwynn. Levels som fanns redan i första snapshoten räknas som "före mätningen"
och ger varken kronor eller plats i Förstafemman.

**Händelser** (`events.jsonl`) får klockslag från körningen som upptäckte dem: `level`, `login`, `logout`,
`hk` och `rep` (ny faktion på Exalted). Ju tätare körningar, desto exaktare. Första körningen för en ny
uppgift (t.ex. rykten) är bara utgångsläge och ger inga händelser.

**Det API:t inte har, och hur vi löser det:**

| Saknas i Classic-API:t | Lösning |
|---|---|
| Yrken | Finns inte. "Först till 300" ersattes av "Först till Exalted" (rykten finns) |
| Healing power | Summeras ur utrustningens "Equip: Increases healing done … by up to N". Enchants och setbonusar räknas inte |
| Utloggningstid | Märks när profilen ändras efter en inloggning. Passlängder är därför uppskattade (± en körning) |
| Beta/PTR | Inga betarealms i API:t. `dynamic-classic-beta` finns men är tom |

**Helkroppsbilder.** Blizzards `character-media` ger `main-raw` (1600×1200, genomskinlig). De hämtas bara för
topp tre per topplista, totalt och per klass (ca 60 st), förnyas efter 20 timmar och rensas när någon faller ur.
Bygget beskär dem med **samma skala räknat från fötterna** (`RENDER_REF`), så att en gnome inte blir lika lång som en night elf.

**Robusthet.** Alla anrop görs om upp till fyra gånger vid timeout eller avbrutet svar, även inloggningen.
En karaktär som inte svarar hoppas över i stället för att fälla körningen. Loggen ligger i `data/hc/hamtning.log`.

## Formspråket

Reglerna nedan är bestämda efter mycket provande. Följ dem hellre än att hitta på nya.

### Typsnitt: tre röster, samma logik som Blizzards Forever-sida

| Typsnitt | Variabel | Används till |
|---|---|---|
| **Cinzel** | `--font-display` | Loggan och rubriker (alltid versaler) |
| **Marcellus** | `--font-ui`, `--font-label` | Det som i spelet står i Friz Quadrata: små rubriker ovanför sektioner, etiketter, knappar, namn, sloganen |
| **Open Sans** | `--font-body`, `--font-num` | Allt man läser, menyn, statusraden och **alla siffror** |

- Marcellus har bara en vikt. Falsk fetstil är avstängd (`font-synthesis: none`); det som ska vara fetare får en tunn
  kontur i samma färg (`-webkit-text-stroke`). Hierarki görs med storlek och färg.
- Siffror står aldrig i Marcellus: dess nolla ser ut som ett O. En siffra inne i en Marcellus-etikett ("på level 60", "Resan till 60") sätts med `NUM()` i app.js, som ger klassen `.n` (Open Sans).
- Storlekar för gränssnittstext: 12 · 14 · 15 · 17 · 20 px. Versaletiketter har spärrningen `--cap`.

### Färger: varje färg har en roll

| Färg | Betyder | Exempel |
|---|---|---|
| **Blått** | Det man gör | Knappar, valda flikar och filter i Alliance-bannerns marinblå (`--navy-500/600`) med guldkant och guldtext. Klarblått bara som ljus (skenet under pallen, meeting stone) |
| **Guld** | Det man uppnår | Rubrikernas slutord, små rubriker, kronor, klara achievements, din egen rad, "NY"-taggar |
| Klassfärger | Vem | Bara på namn och porträttramar |
| Kvalitetsfärger (blå/lila/orange) | Rang | Bara på pallen och kronkorten |
| Grönt | — | Används inte (undantag: healer-ikonen och "lever"-pricken vid Uppdaterad) |

Rubriker har sin bärande del i guld: `<h2 class="d1">Guildens <span>highscore</span></h2>`.

### Pergamentet betyder "resultat och utmärkelser"

Achievement-bakgrunden används där något uppnås eller avgörs: achievements, kronkorten (level 40/50/60),
utmärkelsekorten i statistiken, highscore-listan, jämförelsebladet, nyckeltalen och Förstafemman. Guldpergament = taget, mörkt = inte avgjort än.
Diagrammen ligger på mörkt pergament med guldkurvor (toppunkten benvit med guldring). Gruppsöket har sin egen stil: spelets Group Finder-fönster
(panelen med äventyrarna och spelets rollikoner).

### Spelets egen grafik

| Var | Grafik | Källa |
|---|---|---|
| Achievements, kronkort | Ram, pergament, sköld, level- och rangikoner | `assets/raw/interface/achievementframe`, `icons` |
| Topplistornas rubrik | Föremålsikoner (bröstplåt, svärd, trollstav, talisman, sköld) | `assets/raw/interface/icons/*.jpg` |
| Pallen | Helkroppsbilder på lådor, Alliance-bannern bakom ettan | API:t · `assets/raw/world/crate`, `banner` |
| Gruppsöket | Dungeon Finder-ögat (80 rutor, animerat), meeting stone som bakgrund | `assets/raw/interface/hud` · `assets/raw/world/meetingstone` |
| Flytta in | En lägereld under kanten: sken och gnistor (canvas) | egen |

3D-modellerna (sten, banner, låda) renderas en gång av bygget till `hemmet/ach/*.webp`. Ta bort filen för att rendera om.

### Texterna

Sidan pratar med guilden, inte om sig själv. Inga funktionsbeskrivningar ("du kan spola i tiden",
"tomma platser visar…") och ingen teknik i sektionerna: den står i FAQ:n under "Var kommer siffrorna på sidan ifrån?".
Förklaringar som ändå behövs läggs som ?-knapp med tooltip (`.help`). Tonen är varm, "vi", med glimt i ögat:
"Vem är guildens Jokerd?", "– Mamma, kan vi köra Deadmines? – Vi har Deadmines hemma."

## Förhandsvisningen (DEMO)

En fristående demo med påhittad historik, för guildledningen och för rekrytering ("det här vill jag vara en del av").

```bash
python scripts/fetch_hemmet.py --realm spineshatter --guild "gli tch" --out data/demo-bas   # en gång
python scripts/build_demo.py                                                                 # → DEMO/
```

- **Karaktärerna** är GLI TCH:s riktiga (namn, klass, porträtt, helfigurer, utrustning), hämtade till `data/demo-bas/`.
- **Historiken** är påhittad och seedad (samma varje gång): alla börjar på level 1 den 5 november och levlar till 24 december.
  Hämtningen simuleras: var 30:e minut till 1 december (racet), sedan varje timme; dings får hämtningens tidpunkt.
  Sidan är fylld överallt: minst en tank, healer och dps per dungeon i slutet, och nya medlemmar under julveckan.
  Levels per dag, dings med klockslag, spelpass, kills och Exalted skrivs till `data/demo/` i samma format som den riktiga hämtningen.
  Takten styrs av `HOURS` (speltimmar till 60) i `build_demo.py`; nuläget (item level, HP …) räknas om från TBC-siffror till level 60.
- **Sidan** är samma mall och `app.js`, byggd med `--demo`: "nu" fryses vid 24 dec 21:30 (`DATA.demo.now`), texterna byts till
  "vad som kommer"-form ("Följ resan till 60" …) med ett extra stycke och knapparna FAQ och Flytta in, och en märkning
  "Förhandsvisning · exempeldata" ligger i hörnet. Nedräkningen i heron är fortfarande riktig.
- **`DEMO/`** är fristående (egna spritar, `demo-renders/`, `ach/`, `zones/`): ladda upp hela mappen via FTP.
  Den riktiga sidan, `data/hc` och schemaläggningen rörs inte. Förhandsgranska lokalt på http://localhost:5173/demo.html.

Texterna för demon sätts i `app.js` (`if (DEMO_MODE) { … }`).

**Rekryteringssidan (`DEMO_LIVE/`)** byggs i samma körning (`--demo --recruit`): bara heron, "A Guild of Guilds", FAQ och
Flytta in syns. "Se vad som väntar" (hero och meny) öppnar demons sektioner i en overlay ovanpå sidan (`#showcase`),
med "Stäng" och Esc. FAQ- och Flytta in-knapparna inne i overlayen stänger den och scrollar dit. Ladda upp hela mappen.

**Pilarna** (den handritade pilen i `assets/raw/interface/arrow.png`, färgad guld av bygget): en per sida och de pekar på
det man ska prova. På rekryteringssidan mot "Se vad som väntar", i demon mot spelknappen ("Tryck här och se guilden levla!",
försvinner när man tryckt).

## När HEMMET finns i spelet

Byt realm, guild och utmapp i `scripts/hamta-frienship.bat`:

```bat
python scripts\fetch_hemmet.py --realm <realm> --guild "HEMMET" --out data/hemmet
python scripts\build_hemmet.py --src data/hemmet
```

`fetch_hemmet.py` provar namnrymderna `classicann`, `classic1x` och `classic` och väljer den där guilden finns.
Hamnar Forever i en ny namnrymd läggs den till i listan i `configure()`.

## Publicering

**GitHub Actions** (`.github/workflows/hamta.yml`) kör hämtning och bygge var 30:e minut (och via "Run workflow"),
committar datan (`members`, `items`, `state`, `events`, `snapshots`) tillbaka till repot och publicerar `dist/`
på **GitHub Pages**: https://fredrik-holmlund.github.io/Hemmet_test/ . Porträtt, ikoner och helkroppsbilder
ligger i Actions-cachen, inte i repot. Boten committar var 30:e minut: kör `git pull` innan du ändrar lokalt.

Secrets (Settings → Secrets and variables → Actions): `BNET_ID`, `BNET_SECRET`.
Pages: Settings → Pages → Source: GitHub Actions. Egen domän: skriv in den under Settings → Pages → Custom domain
och lägg hos domänleverantören en CNAME för `www` → `fredrik-holmlund.github.io` samt GitHubs A-poster för domänen utan www.
Realm och guild står överst i workflowen (`REALM`, `GUILD`): byt dem när HEMMET finns.
Lokalt fungerar allt som förut med `.env`; Windows-schemat är avstängt.
