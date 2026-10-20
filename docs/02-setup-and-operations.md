# 2. Instalacja, konfiguracja i uruchomienie lokalne

<!-- channel: instalacja-i-konfiguracja -->

<div class="section-subtitle">Wymagania systemowe, konfiguracja zmiennych środowiskowych oraz procedury startowe</div>

Niniejszy rozdział opisuje kroki niezbędne do poprawnego zainstalowania zależności, skonfigurowania zmiennych środowiskowych oraz uruchomienia bota w środowisku deweloperskim i produkcyjnym.

---

## 2.1. Wymagania systemowe

<div class="section-subtitle">Wymagane wersje oprogramowania bazowego na maszynie hosta</div>

Przed przystąpieniem do instalacji należy upewnić się, że w systemie zainstalowane są:

- **Node.js w wersji 24 lub nowszej:** Wymagany ze względu na natywne wsparcie dla `fetch`, `AbortSignal.timeout`, `crypto` oraz nowoczesnych API JavaScript.
- **pnpm w wersji 11 lub nowszej:** Rekomendowany i przypisany w `package.json` menedżer pakietów.
- **Dostęp do portu sieciowego:** Domyślnie port `3001` dla serwera dokumentacji i callbacku Notion.
- **Konto Discord Developer:** Zarejestrowana aplikacja bota z wygenerowanym tokenem bota i identyfikatorem aplikacji.
- **Google Cloud Console:** Projekt z włączonym YouTube Data API v3 i wygenerowanym kluczem API.

---

## 2.2. Konfiguracja zmiennych środowiskowych (.env)

<div class="section-subtitle">Struktura pliku konfiguracyjnego i ochrona danych poufnych</div>

Skopiuj plik wzorcowy `.env.example` do pliku `.env`:

```sh
cp .env.example .env
```

Plik `.env` zawiera następujące parametry:

```dotenv
DOTENV_CONFIG_QUIET=true

# Discord
CLIENT_ID=twoje_client_id_discord
DISCORD_TOKEN=twoj_tajny_token_bota
DISCORD_INVITE_URL=https://discord.com/oauth2/authorize?client_id=twoje_client_id&scope=bot%20applications.commands
OWNER_ID=twoje_id_uzytkownika_discord
GUILD_ID=opcjonalne_id_serwera_dla_testow

# YouTube Data API v3
YOUTUBE_API_KEY=twoj_klucz_api_google

# Serwer Web (Dokumentacja i OAuth Callback)
WEB_HOST=127.0.0.1
WEB_PORT=3001

# Opcjonalna integracja Notion OAuth
NOTION_CLIENT_ID=twoje_client_id_notion
NOTION_CLIENT_SECRET=twoj_secret_notion
NOTION_REDIRECT_URI=https://twoja-domena.pl/notion/oauth/callback
NOTION_TOKEN_ENCRYPTION_KEY=32_bajtowy_klucz_base64
```

> **Ważne zasady bezpieczeństwa:**
>
> 1. Nigdy nie dodawaj pliku `.env` do repozytorium Git (jest on zignorowany w `.gitignore`).
> 2. Klucz szyfrowania `NOTION_TOKEN_ENCRYPTION_KEY` musi być stały pomiędzy restartami — jego utrata uniemożliwi odczyt zapisanych tokenów Notion. Wygenerujesz go poleceniem:
>    ```sh
>    node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
>    ```

---

## 2.3. Instalacja zależności i uruchomienie lokalne

<div class="section-subtitle">Pobieranie pakietów przez pnpm i start procesu w trybie nodemon</div>

Zainstaluj zależności projektu:

```sh
pnpm install
```

Uruchom bota w trybie lokalnym:

```sh
pnpm start
```

Polecenie `pnpm start` uruchamia narzędzie `nodemon`, które automatycznie restartuje aplikację po wykryciu zmian w kodzie źródłowym (z wyłączeniem folderów `data/*` i `logs/*`).

`DISCORD_INVITE_URL` jest opcjonalnym, publicznym adresem instalacji bota, nie tokenem. Skopiuj link z Discord Developer Portal ze scope `bot` i `applications.commands` oraz uprawnieniami potrzebnymi wybranym funkcjom. Wartość musi używać HTTPS i nie zawierać loginu ani hasła. Brak wartości wyłącza przycisk na stronie głównej; błędna wartość powoduje odpowiedź HTTP 500 tej strony. Komenda `/invite` ma inne przeznaczenie: zaprasza użytkowników do bieżącego serwera.

---

## 2.4. Wdrażanie komend slash w Discordzie

<div class="section-subtitle">Rejestracja interakcji /youtube i /notion na serwerze testowym lub globalnie</div>

Bot wykorzystuje system komend slash Discorda. Przed pierwszym użyciem należy zarejestrować komendy:

1. **Dla pojedynczego serwera testowego (natychmiastowa aktualizacja):**
   Upewnij się, że w `.env` uzupełniono `GUILD_ID`, a następnie wykonaj:
   ```sh
   pnpm deploy:guild
   ```
2. **Dla wszystkich serwerów globalnie (może zająć do 1 godziny na propagację):**
   ```sh
   pnpm deploy:global
   ```
3. **Czyszczenie zarejestrowanych komend (w razie potrzeby resetu):**
   ```sh
   pnpm deploy:clear
   ```

---

## 2.5. Wbudowany serwer Express z dokumentacją i adresem zwrotnym

<div class="section-subtitle">Dostęp do dokumentacji oraz wspólny punkt wejścia dla autoryzacji Notion</div>

Po uruchomieniu bota automatycznie startuje serwer Express pod adresem:
`http://127.0.0.1:3001` (lub wskazanym w `WEB_HOST` i `WEB_PORT`).

Serwer ten pełni cztery funkcje:

1. **Dostęp do dokumentacji:** Udostępnia niniejszy podręcznik w przeglądarce pod adresem `http://127.0.0.1:3001/` z podziałem na rozdziały `/docs/:slug`. Strona główna łączy sekcję wprowadzającą ze schematem YouTube → Discord / Notion i treścią pliku `README.md` od pierwszego nagłówka `##`, bez powtarzania tytułu i wstępu. Na GitHubie README pozostaje samodzielnym wprowadzeniem. Względne odnośniki do przewodników Markdown są w serwisie zamieniane na trasy `/docs/:slug`, a `/table-of-contents` prezentuje listę rozdziałów.
2. **Przewodnik po komendach:** Trasa `/commands` generowana jest podczas startu z plików `commands/<grupa>/*.js`. Pokazuje komendy, podkomendy, typy i wymagane parametry oraz zdefiniowane wartości wyboru. Po zmianie definicji zrestartuj proces, a komendy w Discordzie zarejestruj ponownie.
3. **Wyszukiwarka i nawigacja:** Pole wyszukiwania (`Ctrl + K`) odpytuje endpoint `/search-index.json` zawierający dokumenty, nagłówki `##` oraz komendy. Wybranie wyniku automatycznie przewija do odpowiedniej sekcji. Lista po lewej wyróżnia bieżący rozdział, podąża za aktualną sekcją podczas przewijania dokumentu i przewija własny obszar, aby odpowiednia pozycja pozostała widoczna. Podtytuły nie są podświetlane; postęp zaznacza wyłącznie bardzo subtelna, ciągła linia o szerokości jednego piksela. Jej wypełnienie aktualizuje się bez opóźnienia, również pomiędzy nagłówkami: wolne przewijanie daje wolny ruch, a szybkie odpowiednio szybszy. Po zatrzymaniu przewijania linia również się zatrzymuje.
4. **Obsługa OAuth Notion:** Odbiera powrót przeglądarki po autoryzacji pod adresem `/notion/oauth/callback`, eliminując konieczność uruchamiania osobnego portu. Endpoint `/healthz` zwraca `{"status":"ok"}` dla monitorowania zewnętrznego.

W przypadku wystawienia dokumentacji i autoryzacji do sieci publicznej, należy umieścić aplikację za serwerem reverse proxy (np. Nginx lub Caddy) z certyfikatem SSL/TLS (HTTPS).

W widoku do 900 px nawigacja, wyszukiwarka i linki zewnętrzne są schowane pod hamburgerem. Menu wypełnia dostępną wysokość ekranu, uwzględnia bezpieczne obszary urządzenia i blokuje przewijanie tła. Wyniki wyszukiwania nakładają się na listę kanałów bez przesuwania przycisków. Wysokości paneli i ekranów komunikatów korzystają z dynamicznego obszaru przeglądarki.

Pod sekcją wprowadzającą strony głównej znajduje się gwiezdny przycisk zaproszenia. Na desktopie efekt rozwija się przy najechaniu i przyspiesza przy naciśnięciu; po opuszczeniu przycisku warstwy stopniowo zanikają. Na urządzeniach dotykowych bez hoveru efekt rozwija się automatycznie, znacznie wolniej, z subtelną paralaksą. Ustawienie ograniczonego ruchu wyłącza ruch gwiazd i paralaksę. Link otwiera się w nowej karcie niezależnie od animacji. Aby odłączyć wyłącznie efekt, usuń znacznik skryptu `/assets/invitation-animation.js` z szablonu w `services/web-server.js`; nie zmieniaj głównego skryptu nawigacji.

Bloki kodu w dokumentacji Markdown określają język lub format po otwierających trzech znakach grawisu, np. `sh`, `js`, `json`, `dotenv` albo `text`. Serwis koloruje składnię na serwerze według tej deklaracji; `text` pozostaje zwykłym tekstem, odpowiednim również dla komend Discorda. Nieznane formaty są wyświetlane bez kolorowania. Pasek z nazwą formatu i przyciskiem **Kopiuj** pozostaje nieruchomy podczas przewijania kodu w bok. Kopiowana jest wyłącznie treść kodu, bez etykiety i przycisku.

Wyniki autoryzacji Notion i błędy żądań korzystają ze wspólnego, pełnoekranowego widoku: gradientowego tła i ciemnej karty z komunikatem oraz odnośnikami do dokumentacji. Nieznana strona lub brakujący plik zwraca kod `404`, nieprawidłowy adres kod `400`, a błąd serwera kod `500` — wygląd komunikatu nie zmienia znaczenia odpowiedzi HTTP. Poprawne odpowiedzi `/healthz` i `/search-index.json` pozostają w formacie JSON, a pliki statyczne są zwracane bez opakowania w stronę HTML.

---

## 2.6. Komendy pomocnicze (/about, /echo, /info, /invite, /ping, /reaction, /support)

<div class="section-subtitle">Zestaw komend narzędziowych dostępnych na każdym serwerze Discord bez dodatkowej konfiguracji</div>

Obok głównych modułów `/youtube` i `/notion` bot udostępnia zestaw drobnych komend pomocniczych w katalogu `commands/utility/`. Są one dostępne natychmiast po `pnpm deploy:guild` lub `pnpm deploy:global`:

- **`/about`** — Karta prezentująca tag bota, identyfikator, liczbę serwerów oraz link zapraszający.
- **`/echo input:<treść> [channel:<kanał>] [reply:<bool>] [ephemeral:<bool>]`** — Wysyła wiadomość w imieniu bota na bieżący lub wskazany kanał tekstowy. Treść użytkownika nie jest tłumaczona ani modyfikowana.
- **`/info user [target:<użytkownik>]`** oraz **`/info server`** — Karty informacyjne o użytkowniku lub o bieżącym serwerze (daty utworzenia, role, liczba członków, zaproszenie permanentne).
- **`/invite`** — Zwraca permanentne zaproszenie do bieżącego serwera (preferowany jest `vanityURLCode`, w przeciwnym razie bot wyszukuje własne, nigdy niewygasające zaproszenie lub tworzy nowe).
- **`/ping`** — Mierzy czas odpowiedzi gatewaya Discord na podstawie znaczników czasu wiadomości.
- **`/reaction add message-id:<id> emoji:<emoji>`** / **`/reaction remove message-id:<id> [emoji:<emoji>]`** — Dodaje lub zdejmuje reakcje bota na wskazanej wiadomości (parsuje też identyfikatory w formacie `channel-message`).
- **`/support`** — Karta z linkiem do repozytorium na GitHubie oraz adresem umożliwiającym wsparcie autora.

Pełna lista komend wraz z podkomendami, parametrami, typami i opisami dostępna jest w autogenerowanym widoku webowym pod adresem `/commands`.

---

## 2.7. Wdrożenie produkcyjne (PM2, skrypt run.sh i jedna instancja)

<div class="section-subtitle">Zarządzanie procesem w środowisku produkcyjnym</div>

Na serwerze produkcyjnym zaleca się użycie menedżera procesów PM2 i dołączonego skryptu:

```sh
bash ./run.sh
```

Wymagane są Git, Bash, nvm i wcześniej zainstalowany PM2 dostępny w środowisku wybranego Node.js. Samo `pnpm install` nie instaluje PM2. Skrypt pobiera kod, wybiera Node.js 24, jeśli bieżąca wersja jest starsza, instaluje zależności, rejestruje komendy globalne i próbuje restartu, a następnie startu procesu.

Skróty do samego zarządzania procesem:

```sh
pnpm pm2:start
pnpm pm2:restart
```

- `pm2:start` wykonuje `pm2 start ecosystem.config.js` — użyj przy pierwszym uruchomieniu.
- `pm2:restart` wykonuje `pm2 restart ecosystem.config.js --update-env` — restartuje istniejący proces i odświeża środowisko PM2. Nie jest to ponowna rejestracja komend.
- `.env` jest odczytywany przy starcie aplikacji. Zmienne już ustawione w środowisku procesu mają pierwszeństwo przed wartościami z `.env`.
- Nie uruchamiaj jednocześnie nodemon i PM2 na tych samych plikach `data/`.

Plik konfiguracyjny `ecosystem.config.js` definiuje:

- Dokładnie **jedną instancję** procesu (`instances: 1`). Uruchomienie wielu instancji jest zabronione z powodu wbudowanych blokad in-memory oraz lokalnych plików JSON.
- Automatyczny restart po awarii.
- Wyłączone obserwowanie plików (`watch: false`); zmiana kodu wymaga jawnego restartu.
- Logi w `logs/out.log` i `logs/error.log`.

Stan i logi sprawdzisz poleceniami:

```sh
pm2 status
pm2 logs pielgrzym-bot --lines 100 --nostream
```

`/healthz` potwierdza odpowiedź serwera WWW, nie poprawność połączenia z Discordem ani dostęp do API. Po wdrożeniu sprawdź również logi i `/youtube status`, a dla skonfigurowanego Notion `/notion status`. Ręczne `/youtube check` i `/notion check` wykonują rzeczywiste operacje — używaj ich świadomie.
