# MFM — Code-Review & Business-Roadmap (Übergabe-Dokument)

**Für:** Nächstes Claude-Modell (z.B. Opus) · **Von:** Sonnet-Session Juli 2026
**Projekt-Kontext:** Gustav baut "My Future Me" (MFM) — deutschsprachige KI-Habit-Coaching-PWA,
Zielgruppe 15–30 Jahre. **Erklärtes Ziel: verkaufbares Business, nicht Hobby-Projekt.**


## UPDATE 27.09.2026 — Fokus-Modus (v5) ist jetzt Standard

Grund: Gustav (erster Nutzer) hatte keinen Anreiz, die App zu nutzen — zu viele Features, kein Kern.
Neuer Kern-Loop, alles Alte liegt hinter `S.focusMode=false` (Profil → Ansicht):
- **Morgens:** eine Karte „Dein zukünftiges Ich heute" mit EINEM konkreten Vorhaben aus dem Plan
  (`fmCandidates`/`curSug`: rotiert über `S.fmStrands`, schwache/vernachlässigte Bereiche zuerst,
  Wochenfokus hat Vorrang). Buttons: Das mach ich heute · Anderer Vorschlag · Coach fragen (Haiku) · Eigenes.
- **Abends (ab 17 Uhr oder „Jetzt abhaken"):** Ja / Teilweise / Nein + ein Satz Notiz → `fmSubmit`
  schreibt `S.fmLog` ({d,wd,task,strand,ans,note,set,h}) und Haiku-Feedback mit 7-Tage-Gedächtnis (`memoryCtx`).
- **Plan:** `S.fmStrands` [{title,principle,step,alts}] aus der Onboarding-Analyse (KI-Schema hat jetzt `alts`),
  sonst lokal (`localGoalSuggestions` liefert jetzt auch `strands`). `bgPlanUpgrade` holt einmalig einen KI-Plan nach,
  wenn nur der Offline-Plan existiert. Profil → „Plan mit Coach neu erstellen".
- **Analyse (Warum statt nur Was):** `openFmAnalysis('week'|'month')`, Sonnet-JSON {headline,strength,pattern,why,evidence,next},
  lokaler Fallback `localFmAnalysis` (Notiz-Kategorien via `whyCat`, Wochentage, Bereiche, morgens festgelegt vs. nicht).
  Fällig: Woche ab 4 Check-ins (sonntags/≥7 Tage), Monat ab 12 Check-ins. „Als Wochenfokus übernehmen" schließt den Kreis.
- **UI:** Home (Karte + 14-Tage-Kette), Einblicke (Analysen, Bereiche, Verlauf), Profil (Mein Weg, Ziel/Warum/Start,
  Coach-Stil, 2 Erinnerungen, Backup, KI-Test, Ansicht, Test-Modus mit markierten Demo-Tagen `demo:true`).
- Handy = Vollbild (Media-Query ≤520px, Safe-Areas), Überschriften in Plus Jakarta Sans, Syne nur noch fürs Logo.
- `sw.js` v4: Seite network-first → Updates kommen ohne Neuinstallation der PWA an.
- Neue Hilfen: `esc()` (für alle neuen Nutzertexte genutzt — alte Stellen aus B2 noch offen), `dKey`, `daysAgo`, `fmStreak`.
- Nächster sinnvoller Schritt: Gustavs 7-Tage-Test auswerten (Abbruchtage + Gründe), DANN erst weiterbauen.

---

## TEIL A: IST-ZUSTAND (damit du dich sofort zurechtfindest)

### Architektur
- **Eine Datei:** `index.html` (~1800 Zeilen, 164KB, self-contained: CSS+JS inline)
- **Deploy:** GitHub Pages → https://gusto05.github.io/mfm-app/ (Repo "mfm-app")
- **KI:** Cloudflare-Worker-Proxy → https://mfm-proxy.gustav-business.workers.dev
  (Secret ANTHROPIC_KEY serverseitig; Modelle: claude-haiku-4-5 täglich, claude-sonnet-4-6 für Wochen-Review + Ziel-Analyse)
- **Speicherung:** NUR localStorage (Key 'mfm_v4'), PERSIST-Array definiert was bleibt
- **Dateien:** index.html, sw.js (v3), manifest.json, icon.svg, icon-180/192/512(.png), icon-512-maskable.png
- **Offline-Fallback:** lokale Engines für alles (localPlanFromText, localGoalSuggestions multi-domain, localWeeklyText, analyze())

### Was funktioniert & getestet ist
Onboarding 6 Steps (Willkommen → Profil+Ziel → Standortbestimmung why/start/tried →
KI-Ziel-Analyse mit strands → Mentor-Wahl → Monatsziele), 3 Check-ins/Tag, Streak+Shield,
Wochen-Rückblick (KI+lokal), SVG-Charts mit Tooltips, Theme hell/dunkel, Backup Export/Import,
Focus-Timer, Achievements/Level, natives Teilen, Test-Modus mit 7-Tage-Demo-Daten.

### Bekannte Arbeitsweise mit Gustav
- Deutsch kommunizieren, er testet auf iPhone über die GitHub-Pages-URL
- Edits via Python-Heredoc (str_replace scheitert oft an Sonderzeichen)
- Nach JEDEM Edit: Brace-Balance==0 und Backticks gerade prüfen, dann node-Tests in /tmp
- Service-Worker-Änderungen ⇒ Version bumpen (aktuell mfm-v3) + Nutzer müssen PWA neu installieren
- iOS-Fallen: kein AbortController (→ Promise.race), apple-touch-icon braucht PNG, confirm() blockiert in PWA

---

## TEIL B: KRITISCHE PROBLEME (vor JEDEM Verkauf/Launch beheben)

### B1. Offener Proxy = offenes Portemonnaie ⚠️ HÖCHSTE PRIORITÄT
**Problem:** Der Cloudflare Worker akzeptiert POST von JEDEM. URL steht im Quellcode.
Jeder kann Gustavs API-Key für eigene Zwecke leerlaufen lassen.
**Anweisung an Opus:**
1. Im Worker ein Origin-Check ergänzen: nur `https://gusto05.github.io` als Referer/Origin zulassen
2. Rate-Limit im Worker: max ~40 Anfragen/Tag pro IP (Cloudflare KV oder Durable Object Counter)
3. Später (mit Accounts): pro-User-Token statt IP
4. Anthropic-Spend-Limit prüfen (console.anthropic.com) — sollte gesetzt sein

### B2. XSS-Lücken (14 Stellen)
**Problem:** `S.profile.name/goal/why/start/tried` und KI-Antworten werden unescaped in
innerHTML-Templates interpoliert. Eingabe `<img src=x onerror=alert(1)>` als Name wird ausgeführt.
Bei rein lokaler Nutzung begrenzt kritisch, aber vor Multi-User/Backend zwingend fixen.
**Anweisung an Opus:**
1. Helper einbauen: `const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));`
2. ALLE `${S.profile.*}`, `${...why}`, `${...start}`, `${...tried}`, KI-Texte (`aiS.assessment`,
   `str.principle`, `str.title`, `coachText`, `sug.principle`) durch `${esc(...)}` ersetzen
3. Grep-Muster zum Finden: `\$\{S\.profile\.` und `\$\{aiS\.` und `\$\{sug\.` und `\$\{str\.`

### B3. JSON.parse der KI-Antworten kann crashen
**Problem:** try/catch existiert, aber bei teilweisem JSON (abgeschnittene Antwort) wird null
zurückgegeben und der Nutzer sieht kommentarlos den Fallback. Kein Retry mit Reparatur.
**Anweisung an Opus:** In `fetchGoalSuggestions` bei Parse-Fehler EINEN Reparatur-Versuch:
Regex `r.match(/\{[\s\S]*\}/)` extrahieren, nochmal parsen. Erst dann Fallback.

---

## TEIL C: BUSINESS-BLOCKER (das steht zwischen "nettes Projekt" und "verkaufbar")

### C1. Kein Account-System = kein Business 💰 WICHTIGSTER BUSINESS-SCHRITT
**Warum kritisch:** Ohne Accounts: kein Payment möglich, Daten weg bei Gerätewechsel
(Backup ist manuell), kein Multi-Device, keine Retention-Mails, kein echtes Referral.
localStorage-only ist die größte Einzelbremse für Monetarisierung.
**Anweisung an Opus (empfohlener Stack für Solo-Founder ohne Server-Erfahrung):**
1. **Supabase** (kostenloser Tier reicht lange): Auth (Magic-Link E-Mail — kein Passwort!) + Postgres
2. Tabellen: `profiles` (id, name, age, goal, why, start, tried, mentor, theme, created_at),
   `history` (user_id, date, score, mood, sleep, slq, en, dis, fail), `goals` (user_id, text, progress),
   `habits`, `streaks`
3. Migration: bestehende localStorage-Daten beim ersten Login hochladen (exportBackup-Logik wiederverwenden)
4. Offline-first beibehalten: localStorage bleibt Cache, Supabase synct im Hintergrund
5. Der Cloudflare Worker prüft dann das Supabase-JWT → löst auch B1 sauber

### C2. Premium existiert nur als Kulisse
**Ist:** `isPremium:true` hart codiert, Upgrade-Modal zeigt Preise (6,99€/M, 69€/J) ohne Zahlweg.
**Anweisung an Opus:**
1. Payment: **Stripe Payment Links** (einfachster Start, kein Backend-Code) oder
   Stripe Checkout + Cloudflare Worker Webhook der `profiles.is_premium` in Supabase setzt
2. Free/Premium-Grenze definieren (Vorschlag basierend auf Kostenstruktur):
   - FREE: lokale Engine (0€ Kosten!), 1 Monatsziel, 7 Tage Historie
   - PREMIUM: KI-Coach (Haiku/Sonnet), unbegrenzte Ziele, volle Historie, Wochen-Review mit KI,
     Ziel-Analyse im Onboarding — ABER: Onboarding-Analyse für alle frei lassen (Conversion-Hook!)
3. Paywall-Stellen im Code: `ai()`-Aufrufe mit Premium-Check wrappen; lokale Engine bleibt Free-Fallback
   → Die Architektur ist dafür PERFEKT vorbereitet (jede KI-Funktion hat lokalen Fallback!)

### C3. Blindflug ohne Analytics
**Problem:** Null Einblick: Wo brechen Nutzer im Onboarding ab? Wer kommt Tag 2 wieder?
Ohne das ist jede Produktentscheidung Raten. Für Verkaufsgespräche/Investoren sind
Retention-Zahlen DIE Währung.
**Anweisung an Opus:**
1. **Plausible** (DSGVO-freundlich, script-Tag) oder selbst events in Supabase loggen
2. Events minimal: `onboarding_step_X`, `onboarding_done`, `checkin_morning/mid/eve`,
   `weekly_opened`, `day2_return`, `day7_return`, `share_clicked`, `upgrade_viewed`
3. Wichtigste Kennzahl für dieses Produkt: **D7-Retention** (kommen Leute nach 7 Tagen wieder?)

### C4. Rechtliches (DE-Markt, nicht optional)
**Anweisung an Opus:** Impressum + Datenschutzerklärung als statische Seiten
(KI-Daten gehen an Anthropic via Proxy → muss in DSE stehen; localStorage-Hinweis;
bei Accounts: AVV mit Supabase). Bei Zahlung: AGB + Widerruf. Templates reichen
für den Start, vor Skalierung Anwalt.

---

## TEIL D: PRODUKT-VERBESSERUNGEN (nach Priorität für Verkaufbarkeit)

### D1. Onboarding straffen (Conversion!)
6 Steps sind lang für 15–30-Jährige. Messen (C3), dann: Mentor-Wahl in Step 2 integrieren
oder ans Ende des ersten Tages verschieben. Ziel: unter 90 Sekunden bis zum ersten Aha-Moment
(= die KI-Ziel-Analyse, das stärkste Asset im Funnel).

### D2. Die Fake-Elemente ersetzen oder entfernen
- "Lisa M." (Accountability-Partner) ist hart codiert → nach Accounts (C1): echte Partner-Links,
  bis dahin klar als "Beispiel" kennzeichnen oder ausblenden
- Referral-Code zählt nur lokal → nach C1 echt machen (Supabase: referred_by-Spalte, Belohnung: 1 Monat Premium)

### D3. Kosten-Optimierung KI (Marge!)
- sysP + voller Kontext wird bei jedem Call gesendet → Prompts kürzen wo möglich
- Wochen-Review braucht nicht zwingend Sonnet → A/B: Haiku-Qualität reicht evtl. (~10× günstiger)
- max_tokens pro Use-Case begrenzen (Check-in-Feedback braucht keine 600)
- Kalkulation dokumentieren: Power-User ≈ 90 Haiku-Calls + 4 Sonnet-Calls/Monat ≈ deutlich unter 0,30€
  → Bei 6,99€/Monat ist die Marge exzellent. Das ist das stärkste Business-Argument.

### D4. Web-Push (der größte Produkt-Hebel für Retention)
Aktuell: Notifications nur bei offener App (iOS friert JS ein). Eine Habit-App OHNE
zuverlässige Reminder verliert massiv Retention.
**Anweisung an Opus:** Echte Web-Push-Notifications: VAPID-Keys, Push-Subscription im
Service Worker, Versand über Cloudflare Worker Cron (kostenlos bis 100k Req/Tag).
iOS: ab 16.4, NUR wenn PWA installiert ist. Das ist ein größeres Stück Arbeit (~1 Tag),
aber der wichtigste einzelne Retention-Hebel.

### D5. i18n vorbereiten (Markt ×10)
Alle Strings sind hart codiert Deutsch. VOR weiterem Feature-Ausbau: Strings in ein
`const I18N={de:{...}}` Objekt ziehen. Englisch = 10× größerer Markt, und die
KI-Prompts funktionieren mehrsprachig fast ohne Aufwand.

---

## TEIL E: CODE-QUALITÄT (refactoring, nur wenn Zeit — nicht businesskritisch)

- **Monolith aufteilen** erst NÖTIG bei Team-Arbeit; für Solo+KI-Entwicklung ist die
  eine Datei sogar praktisch. Nicht vorzeitig optimieren.
- Naming inkonsistent (rD/rT/rB vs. openWeekly vs. buildInsights) — bei Gelegenheit vereinheitlichen
- `buildInsights` und `analyze` überschneiden sich — konsolidieren
- Magic Numbers (Score-Gewichtungen in goalProgress: 0.3/0.35/0.2/0.15) als benannte Konstanten
- Test-Harnesses (/tmp/test_*.js) sind flüchtig — ins Repo als `tests/` übernehmen

---

## TEIL F: EMPFOHLENE REIHENFOLGE (Gustavs 90-Tage-Pfad zum verkaufbaren Produkt)

1. **Woche 1:** B1 (Proxy absichern) + B2 (XSS) + C4-Basics (Impressum/DSE) → "safe to share"
2. **Woche 2–3:** C3 (Analytics rein) + 10–20 echte Tester über den Share-Link → DATEN SAMMELN
3. **Woche 4–6:** C1 (Supabase Accounts + Sync) — der große Brocken
4. **Woche 7–8:** C2 (Stripe + Free/Premium-Grenze scharf schalten)
5. **Woche 9–12:** D4 (Web-Push) + D1 (Onboarding nach Daten optimieren) + erste zahlende Nutzer

**Der entscheidende Punkt für "verkaufbar":** Nicht mehr Features. Die App hat GENUG Features.
Was fehlt: Accounts, Payment, Retention-Zahlen, Rechtssicherheit. Ein Käufer/Investor fragt:
"Wie viele Nutzer kommen wöchentlich wieder, was kostet dich ein Nutzer, was zahlt er?" —
alles davon wird erst mit C1–C3 beantwortbar.

---

## ANHANG: Schnellreferenz Codestellen
- KI-Aufruf: `ai(msgs,sys,model,maxTok)` ~Z.525, PROXY_URL ~Z.505
- Ziel-Analyse: `fetchGoalSuggestions` ~Z.302 (strands-Schema!), `triggerGoalSug`, `localGoalSuggestions` ~Z.357
- Onboarding-Rendering: `rOb`, Steps s===1..6, Handler bei `obn`/`obn3`/`obdone`
- Persistenz: `PERSIST`-Array ~Z.1660, `saveState`/`loadState`, Backup: `exportBackup`/`importBackup`
- Wochen-Review: `buildWeeklyReview`/`openWeekly`/`localWeeklyText`
- System-Prompt Coach: `sysP()` (enthält Ziel + Konsistenz-Prinzip)
- Service Worker: sw.js v3 — bei Änderungen Version bumpen!
