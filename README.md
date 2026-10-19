# Pielgrzym

**Nowe publikacje. Bliżej społeczności.**

Pielgrzym to bot Discord do monitorowania wybranego kanału YouTube. Wysyła powiadomienia o nowych filmach i komentarzach na wskazane kanały Discord, regularnie aktualizuje statystyki i opcjonalnie dodaje opublikowane filmy do Notion. Dzięki temu nowe materiały łatwiej trafiają do odbiorców, a opiekunowie serwera mają mniej powtarzalnej pracy.

Film na YouTube może oznaczać powiadomienie na Discordzie, aktualizację licznika i nowy wpis w Notion — bez ręcznego przenoszenia tych samych informacji między usługami.

## Co potrafi Pielgrzym?

### YouTube bliżej Discorda

Każdy serwer Discord może wskazać jeden kanał YouTube. Bot cyklicznie sprawdza nowe filmy oraz komentarze i odpowiedzi. Powiadomienia o publikacjach i aktywności mogą trafiać na wybrane, osobne kanały tekstowe, dzięki czemu rozmowy nie mieszają się z ogłoszeniami.

### Statystyki widoczne od razu

Kanały głosowe mogą prezentować liczbę subskrybentów, filmów i wyświetleń. Statystyki kanału są odświeżane co godzinę, licznik subskrybentów korzysta z tego odświeżenia, a liczniki filmów i wyświetleń są uzgadniane codziennie. Nowo wykryte filmy dodatkowo zwiększają lokalny licznik filmów. To prosty sposób, by pokazać rozwój kanału bez wychodzenia z Discorda.

### Publikacje również w Notion

Opcjonalna integracja dopisuje filmy do wskazanej tabeli Notion: z tytułem, datą publikacji, adresem YouTube i opcjonalnym statusem. Wpisy mogą pojawiać się w widoku kalendarza korzystającym z wybranej kolumny daty.

Pielgrzym tworzy nowe wpisy — nie zmienia ręcznych planów publikacji i nie prowadzi dwukierunkowej synchronizacji.

### Dokumentacja pod ręką

Wbudowana strona WWW udostępnia przewodniki, wyszukiwarkę i katalog komend generowany z definicji bota. To centrum wiedzy o projekcie, nie panel administracyjny — konfiguracja odbywa się przez komendy na Discordzie.

## Jak to działa?

1. Administrator wskazuje kanał YouTube i miejsca powiadomień.
2. Pielgrzym regularnie sprawdza publikacje, aktywność i statystyki.
3. Discord otrzymuje powiadomienia, a skonfigurowane liczniki są aktualizowane.
4. Po połączeniu Notion bot przetwarza kwalifikujące się filmy z lokalnej pamięci podręcznej i dopisuje je do wybranej tabeli.

Monitoring działa cyklicznie, nie w czasie rzeczywistym. Zakres wykrywania komentarzy i ograniczenia API opisano w [przewodniku monitoringu YouTube](docs/03-youtube-monitoring.md).

## Pierwsze uruchomienie

Wymagane są **Node.js >= 24**, **pnpm >= 11**, aplikacja Discord oraz klucz YouTube Data API v3.

1. Skopiuj `.env.example` do `.env` i uzupełnij konfigurację aplikacji Discord oraz klucz YouTube. Dla serwera deweloperskiego ustaw także `GUILD_ID`.
2. Zainstaluj zależności:

   ```sh
   pnpm install
   ```

3. Zarejestruj komendy na serwerze deweloperskim:

   ```sh
   pnpm deploy:guild
   ```

   Przy wdrożeniu globalnym użyj zamiast tego `pnpm deploy:global`.

4. Uruchom aplikację:

   ```sh
   pnpm start
   ```

Dokumentacja WWW jest domyślnie dostępna pod adresem <http://127.0.0.1:3001/>. Adres i port określają `WEB_HOST` i `WEB_PORT`. W serwisie znajdziesz spis treści (`/table-of-contents`), katalog komend (`/commands`) i wyszukiwarkę (`Ctrl + K`).

Notion jest opcjonalny. Jego uruchomienie wymaga publicznej integracji OAuth, stałego klucza szyfrowania oraz publicznego adresu zwrotnego HTTPS zakończonego ścieżką `/notion/oauth/callback`. Bez zmiennych OAuth monitoring YouTube może działać niezależnie; niepełna lub błędna konfiguracja Notion zatrzymuje start aplikacji.

Pełną procedurę znajdziesz w [instrukcji uruchomienia](docs/02-setup-and-operations.md) oraz [przewodniku integracji z Notion](docs/06-notion-integration.md).

## Od czego zacząć?

- [Poznaj projekt i jego architekturę](docs/01-overview-and-architecture.md)
- [Przygotuj środowisko i uruchom bota](docs/02-setup-and-operations.md)
- [Skonfiguruj monitoring YouTube](docs/03-youtube-monitoring.md)
- [Rozdziel kanały powiadomień](docs/04-notification-channels.md)
- [Włącz liczniki statystyk](docs/05-statistics-counters.md)
- [Połącz Notion i skonfiguruj publikowanie](docs/06-notion-integration.md)
- [Sprawdź diagnostykę i ograniczenia](docs/07-troubleshooting.md)

Na Discordzie główne punkty wejścia to `/youtube` i `/notion`. Pełny katalog komend znajdziesz pod ścieżką `/commands` w działającym serwisie dokumentacji.

## Wdrożenie i utrzymanie

Projekt korzysta z Node.js, discord.js i Express. Nie wymaga osobnego serwera bazy danych ani kroku budowania aplikacji.

Na serwerze przygotowanym z nvm i PM2 wdrożenie uruchamia:

```sh
bash ./run.sh
```

Uruchamiaj jedną instancję procesu (`instances: 1`). Zachowuj katalog `data/` i stały klucz szyfrowania Notion między wdrożeniami. Nie publikuj pliku `.env`, tokenów ani lokalnych danych aplikacji. Publiczne udostępnienie dokumentacji i callbacku OAuth wymaga reverse proxy z HTTPS.

Kontrola formatowania i kodu:

```sh
pnpm validate
```
