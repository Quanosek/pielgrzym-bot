# 7. Diagnostyka, rozwiązywanie problemów i limity

<!-- channel: diagnostyka-i-problemy -->

<div class="section-subtitle">Typowe problemy, kody błędów, procedury diagnostyczne i zachowanie spójności danych</div>

W niniejszym rozdziale zebrano najczęstsze trudności konfiguracyjne i operacyjne, sposoby ich szybkiego diagnozowania oraz ograniczenia technologiczne systemu.

---

## 7.1. Błędy uruchomienia bota i kolizje portów

<div class="section-subtitle">Weryfikacja parametrów środowiskowych i dostępności portu serwera Express</div>

### Błąd zajętego portu (`EADDRINUSE`)

- **Objaw:** Bot kończy działanie tuż po uruchomieniu z błędem typu `listen EADDRINUSE: address already in use :::3001`.
- **Rozwiązanie:** Inny proces zajmuje port serwera Express (`WEB_PORT`). Zmień port w pliku `.env` (np. `WEB_PORT=3005`) lub zatrzymaj poprzedni proces.

### Błąd niepełnej konfiguracji Notion przy starcie

- **Objaw:** Bot nie startuje z komunikatem `Notion OAuth configuration is incomplete` lub `NOTION_REDIRECT_URI must be an HTTPS URL...`.
- **Przyczyna:** Podano tylko część zmiennych dla Notion. Jeśli Notion nie jest używane, usuń wszystkie cztery zmienne `NOTION_*` z pliku `.env`. Jeśli integracja ma działać, upewnij się, że uzupełniono wszystkie cztery parametry: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI` (z adresem HTTPS kończącym się na `/notion/oauth/callback`) oraz `NOTION_TOKEN_ENCRYPTION_KEY`.

---

## 7.2. Problemy z kanałem YouTube lub brakiem powiadomień

<div class="section-subtitle">Weryfikacja klucza API, uprawnień kanału tekstowego i limitów Google</div>

### Komunikat „Nie znaleziono kanału YouTube”

- **Rozwiązanie:** Upewnij się, że podajesz dokładną publiczną nazwę kanału lub oficjalny uchwyt z YouTube (np. `nazwakanalu` lub `@nazwakanalu`). Sprawdź, czy kanał nie jest oznaczony jako prywatny lub usunięty.

### Brak powiadomień o nowych filmach

1. Wywołaj komendę `/youtube status` i upewnij się, że monitorowanie jest włączone (`enabled: true`), a kanał tekstowy jest przypisany.
2. Sprawdź, czy rola bota posiada na tym kanale uprawnienia: `ViewChannel`, `SendMessages`, `EmbedLinks`.
3. Wywołaj testowe sprawdzenie komendą `/youtube check type:notifications-videos`.
4. Sprawdź konsolę bota — `quotaExceeded` oznacza wyczerpanie limitu projektu. Reset przypada na 00:00 `America/Los_Angeles`, zwykle 09:00 w Polsce, przejściowo 08:00 przy różnych terminach zmiany czasu.

---

## 7.3. Problemy z licznikami na kanałach głosowych

<div class="section-subtitle">Ochrona przed blokadami Discorda i automatyczne wyłączanie uszkodzonych liczników</div>

### Licznik przestał się aktualizować

- **Uprawnienia:** Do zmiany nazwy kanału głosowego bot bezwzględnie wymaga: `ViewChannel`, `Connect` oraz `ManageChannels`. Jeśli administrator serwera odbierze którekolwiek z tych uprawnień, bot wyłączy licznik w konfiguracji, aby nie generować powtarzających się błędów w logach.
- **Rzadka zmiana wartości:** Licznik subskrypcji odświeża się co godzinę i zmienia nazwę tylko wtedy, gdy YouTube zaraportuje zmianę liczby subskrybentów. Brak zmiany nazwy przy stałej liczbie subskrybentów jest zachowaniem w 100% poprawnym.
- **Ograniczenia Discorda:** Discord limituje modyfikację nazwy kanału do 2 zmian na 10 minut.

---

## 7.4. Problemy z autoryzacją Notion OAuth i dostępem do bazy

<div class="section-subtitle">Typowe błędy podczas łączenia przestrzeni i wskazywania tabeli docelowej</div>

### Błąd 404 lub „Nie znaleziono dostępnej bazy” przy /notion enable

- **Najczęstsza przyczyna:** Podczas autoryzacji w przeglądarce (`/notion connect`) użytkownik zaznaczył stronę nadrzędną lub połączony widok zamiast **oryginalnej bazy danych**.
- **Rozwiązanie:** W Notion otwórz właściwą bazę danych w pełnym widoku, skopiuj jej bezpośredni link. W razie potrzeby użyj `/notion connect` ponownie i upewnij się, że na liście udostępnionych stron zaznaczono oryginalną bazę.

### Wygaśnięcie sesji autoryzacyjnej

- Link wygenerowany przez `/notion connect` wygasa po **10 minutach** lub po pojedynczym użyciu. Jeśli minęło więcej czasu, wygeneruj nowe połączenie komendą `/notion connect`.

### Błąd 401 podczas publikacji

- Token dostępu Notion OAuth utracił ważność. Bot automatycznie próbuje odświeżyć token za pomocą `refresh_token`. Jeśli uprawnienia aplikacji zostały całkowicie cofnięte w ustawieniach Notion, administrator serwera musi ponownie użyć `/notion connect`.

---

## 7.5. Zarządzanie plikami runtime w katalogu data/

<div class="section-subtitle">Integralność plików JSON, kopie zapasowe i zachowanie danych</div>

Katalog `data/` zawiera stan wykonawczy bota i nie może być kasowany podczas aktualizacji kodu:

- `data/guild-config.min.json`: Konfiguracja serwerów Discord (kanały, identyfikatory, ustawienia liczników).
- `data/yt-cache.min.json`: Pamięć podręczna filmów i komentarzy (zapobiega ponownemu wysyłaniu starych materiałów).
- `data/notion-auth.min.json`: Zaszyfrowane poświadczenia tokenów Notion dla każdego serwera.
- `data/notion-cache.min.json`: Stan kolejki publikacji Notion i zrealizowane identyfikatory stron.

> **Zasada kopii zapasowej:**
> Przed wdrożeniem nowej wersji bota zawsze twórz kopię zapasową katalogu `data/` oraz klucza `NOTION_TOKEN_ENCRYPTION_KEY`. Zmiana klucza szyfrowania uniemożliwi odczytanie pliku `notion-auth.min.json` i wymusi ponowne połączenie wszystkich serwerów przez `/notion connect`.

---

## 7.6. Nawigacja po dokumentacji webowej i wyszukiwarka

<div class="section-subtitle">Autogenerowany przewodnik komend, dynamiczny spis treści oraz szybki skrót klawiszowy</div>

Wbudowany serwer Express (`services/web-server.js`) prezentuje dokumentację i narzędzia pomocnicze dostępne pod przeglądarkowym adresem `WEB_HOST:WEB_PORT`:

- **Strona główna (`/`):** renderuje zawartość pliku `README.md` z dodatkowym gradientowym kafelkiem powitalnym.
- **Spis treści (`/table-of-contents`):** gradientowa siatka siedmiu rozdziałów z zakładkami nagłówków `##`.
- **Komendy (`/commands`):** przewodnik generowany podczas startu z `commands/<grupa>/*.js` przez `SlashCommandBuilder.toJSON()`. Zmiana definicji wymaga restartu serwera WWW, a w Discordzie także ponownego wdrożenia komend.
- **Wyszukiwarka (`Ctrl + K` / `⌘ + K`):** pole wyszukiwania w prawym górnym rogu zapytuje endpoint `/search-index.json`. Wyniki obejmują dokumenty, poszczególne sekcje `##`, komendy i podkomendy. Wybranie wyniku automatycznie przewija do odpowiedniej sekcji.

> **Dostępność sieciowa:**
> Wystawienie serwera do internetu wymaga reverse proxy z HTTPS. Nagłówek `Content-Security-Policy` nie zezwala na skrypty i źródła zewnętrzne poza aktywami `self` i czcionkami Google; nie dodawaj do widoków `<script>` inline ani zewnętrznych skryptów.

Na telefonie wyszukiwarka i lista kanałów znajdują się pod hamburgerem. `Escape` zamyka menu, a `Ctrl + K` / `⌘ + K` otwiera je i kieruje fokus do wyszukiwarki. Wyniki przykrywają kanały bez zmiany pozycji przycisków. Pełnoekranowe tło dopasowuje się do dostępnej wysokości; ustawienie ograniczonego ruchu wyłącza ruch gwiazd i paralaksę zaproszenia.

Numer wydania dokumentacji, headera i stopki pochodzi z pola `version` w `package.json`. Po aktualizacji zwiększ tę wersję i zrestartuj proces. Adresy stylów, skryptów, awatara i ikon zawierają wersję, więc przeglądarka pobierze nowe zasoby przy zwykłym otwarciu lub odświeżeniu strony. Dokumenty HTML wymagają ponownej walidacji cache; przejście do innej podstrony z otwartej karty po zmianie wydania wymusza pełne załadowanie nowej wersji. Już otwarta, bezczynna karta nie odświeża się samoczynnie.

Zasoby `/assets` i `/images` zachowują godzinny cache dla danego adresu. Zmiana plików bez zwiększenia wersji może nadal wymagać twardego odświeżenia podczas pracy lokalnej. Favicon jest dostępny jako PNG i wielorozmiarowy ICO, a ikony ekranu początkowego przez Apple Touch Icon oraz manifest. Ikony zachowują dostarczony rysunek rakiety po usunięciu szachownicy. W repozytorium pozostają tylko używane warianty: `favicon.ico` (16/32/48 px), `favicon-32x32.png`, `apple-touch-icon.png` (180 px) oraz `icon-192x192.png` i `icon-512x512.png`. Wszystkie pliki ikon mają przezroczyste tło; system może dodać własne tło lub maskę. Brak aktywnego zaproszenia oznacza brak `DISCORD_INVITE_URL`, a nie błąd połączenia z Discordem.

## 7.7. Granice weryfikacji, prywatność i licencja

`pnpm validate` sprawdza formatowanie i ESLint. Nie loguje bota, nie weryfikuje uprawnień w rzeczywistym serwerze i nie potwierdza dostępu do Notion. Repozytorium nie zawiera stałego zestawu testów ani skryptu `test`; dodatkowe kontrole wykonuje się lokalnie na mockach i odizolowanym serwerze dokumentacji, bez odczytu prywatnych plików runtime.

Udostępnianie instancji publicznie wymaga oceny rzeczywiście przetwarzanych danych, logów reverse proxy i usług zewnętrznych. Callback OAuth nie powinien mieć logowanych parametrów zapytania. Informacja w stopce o braku gwarancji i ochronie sekretów nie zastępuje polityki prywatności, analizy obowiązków prawnych ani bezpiecznej konfiguracji wdrożenia.

Projekt korzysta z licencji GNU Affero General Public License v3.0 (`AGPL-3.0-only`), zgodnie z plikiem [LICENSE](https://github.com/Quanosek/Pielgrzym/blob/HEAD/LICENSE) i deklaracją w `package.json`. Przy udostępnianiu zmodyfikowanej wersji przez sieć zapewnij użytkownikom dostęp do odpowiadającego jej kodu źródłowego zgodnie z sekcją 13. Po wdrożeniu własnych zmian zaktualizuj odnośnik „Kod źródłowy” w stopce, aby prowadził do kodu działającej wersji, a nie wyłącznie do oryginalnego repozytorium.
