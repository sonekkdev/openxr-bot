# openXR bot

Bot Discord obsługujący wyłącznie komendy slash. Działa na **Cloudflare Workers**: Discord wysyła każde użycie komendy jako HTTPS POST, Worker weryfikuje podpis Ed25519 i od razu odpowiada. Nie ma procesu działającego 24/7 i nie potrzebujesz serwera — a odpowiedzi i tak są natychmiastowe.

W zestawie: `/ping` i `/help`. Kolejne komendy dodajesz w `src/commands.js`.

## Wymagania

- Node.js 20+ i darmowe konto Cloudflare.
- Aplikacja w [Discord Developer Portal](https://discord.com/developers/applications).
- Uprawnienia do dodania aplikacji na swój serwer.

## 1. Aplikacja Discord

1. **New Application** → nazwa, np. `openXR bot`.
2. **General Information** → skopiuj **Application ID** i **Public Key**.
3. **Bot** → **Reset Token** → skopiuj token (widać go tylko raz).
4. **OAuth2 → URL Generator**: zaznacz scope `applications.commands`, otwórz wygenerowany URL i dodaj aplikację na serwer. Scope `bot` nie jest potrzebny.
5. Nie zamykaj karty — dane będą potrzebne w kolejnych krokach.

## 2. Cloudflare

W folderze projektu:

```powershell
npm install
npx wrangler login
npx wrangler secret put DISCORD_PUBLIC_KEY
```

Wklej **Public Key** z Discorda (to nie jest sekret, ale trzymanie go poza repo jest wygodniejsze). Następnie:

```powershell
npm run deploy
```

Wrangler wypisze adres w stylu `https://openxr-bot.twoj-subdomain.workers.dev`. Przy pierwszym deployu może zaproponować rejestrację subdomeny `workers.dev` — zgódź się.

## 3. Podłącz endpoint

Discord Developer Portal → Twoja aplikacja → **General Information** → **Interactions Endpoint URL** → wklej adres Workera → **Save Changes**.

Discord wyśle żądanie PING. Jeśli klucz jest poprawny, zapis się uda. Jeśli nie — zobacz sekcję Problemy.

## 4. Zarejestruj komendy

W PowerShell:

```powershell
$env:DISCORD_APPLICATION_ID = "123456789012345678"
$env:DISCORD_BOT_TOKEN = "MTIz..."
$env:DISCORD_GUILD_ID = "987654321098765432"   # opcjonalnie: tylko ten serwer, działa od razu

npm run register
```

- Z `DISCORD_GUILD_ID` komendy pojawiają się natychmiast.
- Bez niego rejestrują się globalnie — Discord może je pokazać dopiero po godzinie.
- `npm run register` używa `PUT`, więc **zastępuje całą listę** komend aplikacji. Jeśli masz inne komendy, dopisz je do `src/commands.js`.
- Token jest potrzebny tylko do rejestracji. Worker go nie przechowuje.

## 5. Test

Na serwerze wpisz `/ping` i `/help`.

## Dodanie własnej komendy

W `src/commands.js` dopisz obiekt do tablicy `commands`:

```js
{
  definition: { name: "hello", description: "Say hello." },
  execute: () => ({ content: "Hello!" }),
}
```

Potem:

```powershell
npm run register
npm run deploy
```

`definition` to normalna definicja komendy Discorda (możesz dodać `options`). `execute({ interaction, startedAt })` zwraca obiekt `data` odpowiedzi — np. `{ content: "..." }` albo `{ embeds: [...] }`.

## Jak to działa

1. Discord wysyła POST z nagłówkami `X-Signature-Ed25519` i `X-Signature-Timestamp`.
2. Worker składa `timestamp + raw body` i weryfikuje podpis kluczem publicznym aplikacji.
3. `PING` (typ 1) → odpowiedź `{"type":1}`.
4. Komenda slash (typ 2) → odpowiedź `{"type":4,"data":...}`.
5. Discord wymaga odpowiedzi w 3 sekundy; Worker odpowiada w milisekundach.

Brak połączenia Gateway oznacza brak presence i brak czytania zwykłych wiadomości — ale do samych komend to nie jest potrzebne.

## Test lokalny

```powershell
Copy-Item .dev.vars.example .dev.vars
# wklej Public Key do .dev.vars
npm run dev
```

Worker będzie na `http://127.0.0.1:8787`. Aby przetestować z prawdziwego Discorda, wystaw go tunelem (np. `cloudflared tunnel --url http://127.0.0.1:8787`) i wpisz tymczasowy adres jako Interactions Endpoint URL. Prościej: `npm run deploy` — wdrożenie trwa kilka sekund.

## Problemy

- **`Invalid request signature` / 401** — zły `DISCORD_PUBLIC_KEY`. Ustaw go ponownie: `npx wrangler secret put DISCORD_PUBLIC_KEY` i zrób deploy.
- **Discord nie chce zapisać endpointu** — Worker nie odpowiada poprawnie na PING. Sprawdź `npx wrangler tail` i klucz publiczny.
- **`This interaction failed`** — błąd w Workerze albo brak deployu. `npx wrangler tail` pokaże log.
- **Brak komend** — globalne mogą się pojawić po godzinie. Do testów użyj `DISCORD_GUILD_ID`. Upewnij się, że aplikacja jest dodana na serwer z scope `applications.commands`.
- **Token wyciekł** — zresetuj go w **Bot → Reset Token**.

## Limity i bezpieczeństwo

- Free plan Workers: 100 tys. żądań dziennie i 10 ms CPU na żądanie. Komendy slash to ułamek tego.
- W Workerze jest tylko klucz publiczny. Token bota trzymaj wyłącznie w zmiennych środowiskowych — nigdy w repo.
- Cloudflare Workers nie utrzymuje stałego połączenia; dla bota wyłącznie na komendy to zaleta, nie ograniczenie.
- GitHub Actions może ten Worker **wdrażać**, ale nie może go hostować jako procesu 24/7.
