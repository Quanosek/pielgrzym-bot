# 6. Integracja z Notion, autoryzacja OAuth i kalendarz publikacji

<!-- channel: integracja-notion -->

<div class="section-subtitle">Publiczne połączenie OAuth, mapowanie kolumn, dodawanie wierszy i import historii</div>

W tym rozdziale opisano architekturę i konfigurację integracji z Notion, w ramach której bot automatycznie dodaje nowe wiersze z opublikowanymi filmami YouTube do wybranej bazy danych i kalendarza Notion.

---

## 6.1. Koncepcja integracji: Notion jako cel publikacji

<div class="section-subtitle">Jednokierunkowy przepływ danych z YouTube do Notion bez modyfikacji planów manualnych</div>

Integracja Notion w bocie Pielgrzym została zaprojektowana według ścisłych założeń biznesowych:

- **Tylko cel publikacji (Output Destination):** Notion jest miejscem zapisu historii i nowych publikacji. Bot **nie czyta** planów z innych tabel, **nie planuje** publikacji w YouTube i **nie modyfikuje** ręcznie utworzonych wpisów według tytułu.
- **Jedna przestrzeń i jedna tabela na serwer:** Każdy serwer Discord może połączyć jedną własną przestrzeń Notion i wskazać jedną tabelę docelową.
- **Brak konieczności współdzielenia konta:** Autor bota nie musi posiadać dostępu ani konta w przestrzeni roboczej Notion administratora serwera Discord — autoryzacja odbywa się przez publiczny standard OAuth 2.0.

---

## 6.2. Konfiguracja publicznej aplikacji OAuth w Notion

<div class="section-subtitle">Krok jednorazowy realizowany przez opiekuna bota w portalu deweloperskim Notion</div>

Opiekun instancji bota tworzy integrację publiczną w portalu deweloperskim Notion:

1. Przejdź do [Notion Developers Integrations](https://www.notion.so/profile/integrations) i utwórz integrację typu **Public integration**.
2. W sekcji **Capabilities** włącz uprawnienia:
   - **Read content** (odczyt schematu tabeli i sprawdzanie duplikatów URL).
   - **Insert content** (tworzenie nowych stron/wierszy).
3. W sekcji **OAuth Domain & URIs** podaj adres powrotu:
   `https://twoja-domena.pl/notion/oauth/callback`
4. Skopiuj wygenerowane poświadczenia do pliku `.env` na serwerze bota:
   ```dotenv
   NOTION_CLIENT_ID=twoje_client_id
   NOTION_CLIENT_SECRET=twoj_client_secret
   NOTION_REDIRECT_URI=https://twoja-domena.pl/notion/oauth/callback
   NOTION_TOKEN_ENCRYPTION_KEY=wygenerowany_32_bajtowy_klucz_base64
   ```
5. Uruchom serwer Express z obsługą HTTPS przez reverse proxy. Trasa `/notion/oauth/callback` jest automatycznie obsługiwana przez serwer Express.

---

## 6.3. Łączenie przestrzeni roboczej per-serwer Discord

<div class="section-subtitle">Procedura autoryzacji /notion connect z dwustopniowym zatwierdzeniem</div>

Gdy opiekun skonfigurował aplikację OAuth, administrator dowolnego serwera Discord wykonuje kroki:

1. Wpisz komendę:
   ```text
   /notion connect
   ```
2. Bot wygeneruje prywatną odpowiedź z unikalnym linkiem autoryzacyjnym zawierającym bezpieczny, kryptograficzny token stanu (`state`, ważny 10 minut).
3. Kliknij **Autoryzuj w Notion**. Otworzy się oficjalna strona Notion, na której:
   - Wybierasz swoją przestrzeń roboczą (do której masz prawa).
   - **Bardzo ważne:** Zaznaczasz i udostępniasz aplikacji **oryginalną bazę danych** (nie połączony widok ani podstronę).
4. Po zatwierdzeniu przeglądarka wyświetli pełnoekranowy komunikat **Notion udzielił dostępu** z nazwą przestrzeni i instrukcją kolejnych kroków. Sam ten ekran nie zapisuje połączenia. Wróć do Discorda i kliknij przycisk **Sprawdź autoryzację**.
5. Bot wyświetli nazwę i identyfikator autoryzowanego workspace'u.
6. Kliknij **Potwierdź przestrzeń roboczą**. Tokeny zostaną zaszyfrowane kluczem AES-256-GCM i bezpiecznie zapisane dla Twojego serwera.

Przy odmowie dostępu, nieprawidłowym lub wykorzystanym linku, wygaśnięciu sesji albo błędzie Notion wyświetlany jest komunikat w tym samym ciemnym motywie na niebiesko-grafitowo-zielonym tle. Rozpocznij wtedy nowe połączenie przez `/notion connect`. Ekrany nie pokazują tokenów ani surowych błędów API i nie są zapisywane w pamięci podręcznej przeglądarki. Odświeżenie wykorzystanego linku nie powtarza wymiany kodu.

---

## 6.4. Wybór tabeli docelowej i interaktywny kreator kolumn

<div class="section-subtitle">Konfiguracja /notion enable oraz mapowanie właściwości tabeli</div>

Po połączeniu przestrzeni roboczej administrator wskazuje bazę danych:

```text
/notion enable source:<link do bazy w Notion lub identyfikator źródła danych>
```

Bot pobierze schemat bazy i uruchomi interaktywny kreator krok po kroku:

1. **Wybór źródła danych (jeśli baza zawiera kilka źródeł):** Wybierz odpowiednie źródło z listy.
2. **Kolumna tytułu (`title`):** Wybierz kolumnę, do której trafi zdekodowany tytuł filmu.
3. **Kolumna daty publikacji (`date`):** Wybierz kolumnę typu Date, która steruje Twoim widokiem kalendarza w Notion.
4. **Kolumna adresu URL (`url`):** Wybierz kolumnę typu URL, do której trafi bezpośredni link `https://www.youtube.com/watch?v=...`.
5. **Kolumna statusu (`status` / `select`) — opcjonalnie:** Możesz wybrać kolumnę statusu lub kliknąć `Bez ustawiania statusu`.
6. **Wartość statusu — opcjonalnie:** Jeśli wybrano kolumnę statusu, wskaż wartość oznaczającą opublikowany film (np. `Opublikowano` lub `Gotowe`).

> **Stabilność identyfikatorów:** Bot zapisuje stałe identyfikatory właściwości (`property.id`), dzięki czemu późniejsza zmiana nazwy kolumny w Notion nie psuje integracji!

---

## 6.5. Zapisywanie filmów i widok kalendarza w Notion

<div class="section-subtitle">Formatowanie dat w strefie Europe/Warsaw i prezentacja w kalendarzu</div>

Po zakończeniu konfiguracji bot aktywuje automatyczną publikację:

- **Zadanie publikatora:** Co minutę w tle działa niezależne zadanie `publish-notion-entries`, które przetwarza do 5 filmów z kolejki na przebieg.
- **Format daty kalendarzowej:** Bot zapisuje datę i godzinę faktycznej publikacji w polskiej strefie czasowej `Europe/Warsaw` z uwzględnieniem czasu letniego i zimowego:
  `2026-10-19T18:30:00+02:00`
- **Pojawienie się w kalendarzu:** Wpis pojawia się natychmiast w kalendarzu Notion w dniu i godzinie publikacji, o ile widok kalendarza jest powiązany ze wskazaną kolumną daty i filtry widoku go nie ukrywają.

---

## 6.6. Import historii publikacji z lokalnej pamięci podręcznej

<div class="section-subtitle">Uzupełnianie tabeli filmami opublikowanymi od momentu startu monitorowania YouTube</div>

W momencie pomyślnego zakończenia konfiguracji w `/notion enable` bot oznacza flagę `historyPending = true`:

- Publikator odczytuje lokalną pamięć podręczną filmów (`videosCache`).
- Wszystkie filmy, których data publikacji jest równa lub późniejsza niż data aktywacji monitoringu YouTube (`setupDate`), zostają automatycznie dodane do kolejki publikacji Notion.
- Bot nie wykonuje dodatkowych zapytań do YouTube API — bazuje w 100% na istniejącym lokalnym cache, co nie zużywa ani jednej jednostki limitu Google!

---

## 6.7. Zabezpieczenia transakcyjne, duplikaty i /notion retry

<div class="section-subtitle">Weryfikacja istnienia wpisu, flaga uncertain i komendy serwisowe</div>

Aby wyeliminować ryzyko zduplikowanych wpisów w Notion:

1. **Deduplikacja po URL:** Przed utworzeniem nowego wiersza bot wysyła zapytanie `data_sources/:id/query` z filtrem na kolumnę URL. Jeśli wiersz z takim linkiem już istnieje, zostaje natychmiast oznaczony jako ukończony bez tworzenia duplikatu.
2. **Flaga `uncertain`:** Przed wysłaniem zapytania tworzenia strony bot oznacza wpis w pliku kolejki jako niepewny (`uncertain: true`). Jeśli połączenie zostanie przerwane (np. timeout lub błąd 5xx), bot nie ponawia zapisu automatycznie, dopóki administrator nie sprawdzi tabeli.
3. **Odblokowanie ponowienia (`/notion retry`):**
   ```text
   /notion retry video-id:<identyfikator> confirmed:true
   ```
   Pozwala administratorowi ręcznie odblokować ponowną próbę zapisu po upewnieniu się, że film rzeczywiście nie został utworzony w Notion.
4. **Rozłączenie (`/notion disconnect`):**
   Usuwa lokalne poświadczenia danego serwera i wstrzymuje publikację bez usuwania dotychczasowych wpisów w Notion.
