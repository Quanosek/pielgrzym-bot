# 1. Wprowadzenie i architektura modułowa

<!-- channel: wprowadzenie-i-architektura -->

<div class="section-subtitle">Przeznaczenie bota, zasady projektowe oraz podział na niezależne moduły integracji</div>

Bot **Pielgrzym** to jednoinstancyjna aplikacja Discord do monitorowania wybranego kanału YouTube. Każdy serwer Discord może wybrać własny kanał YouTube, wskazać kanały powiadomień o nowych filmach i komentarzach oraz włączyć liczniki statystyk. Opcjonalna integracja dodaje opublikowane filmy do tabeli Notion, również z widokiem kalendarza. Monitoring i aktualizacje statystyk działają cyklicznie, zgodnie z harmonogramem.

---

## 1.1. Przeznaczenie i cele bota Pielgrzym

<div class="section-subtitle">Monitorowanie publikacji i statystyk YouTube oraz integracja z Discordem i Notion</div>

Głównym zadaniem aplikacji jest wsparcie administratorów i społeczności serwera Discord w bieżącym śledzeniu aktywności powiązanego kanału YouTube:

- **Szybkie powiadamianie:** Informowanie użytkowników o nowych filmach i premierach bez konieczności ręcznego wklejania linków.
- **Monitoring dyskusji:** Wykrywanie nowych komentarzy i odpowiedzi pod filmami oraz przesyłanie ich na dedykowany kanał moderacyjny lub społecznościowy.
- **Wizualne wskaźniki:** Wykorzystanie kanałów głosowych jako dynamicznych liczników subskrypcji, filmów i wyświetleń.
- **Archiwum publikacji w Notion:** Automatyczne dodawanie wpisów o opublikowanych filmach do tabeli Notion powiązanej z widokiem kalendarza, bez zmieniania ręcznych planów.

---

## 1.2. Kluczowe założenia architektoniczne

<div class="section-subtitle">Prostota wdrożenia, brak zewnętrznej bazy SQL i natywne technologie środowiska Node.js</div>

Architektura aplikacji została zaprojektowana z zachowaniem maksymalnej prostoty operacyjnej i wysokiej wydajności:

- **Środowisko Node.js >= 24 i CommonJS:** Aplikacja działa bezpośrednio w środowisku Node.js bez transpilerów (Babel/TypeScript) i bez skomplikowanych etapów budowania.
- **Brak zewnętrznego serwera bazy danych:** Całość stanu konfiguracyjnego i pamięci podręcznej zapisywana jest w plikach JSON w katalogu `data/` z gwarancją serializacji zapisu i atomowości wymiany plików tymczasowych (`.tmp` -> rename).
- **Discord.js v14:** Klient subskrybuje wyłącznie niezbędny intent `GatewayIntentBits.Guilds`, minimalizując obciążenie sieciowe i pamięciowe.
- **Wbudowany harmonogram `node-cron` v4:** Wszystkie zadania cykliczne działają wewnątrz procesu bota (nie jest to cron systemowy systemu operacyjnego).
- **Zintegrowany serwer Express:** Współdzieli port ze statyczną dokumentacją oraz trasą przekierowania OAuth Notion (`/notion/oauth/callback`).

---

## 1.3. Modułowy podział funkcji i odpowiedzialności

<div class="section-subtitle">Niezależne moduły współpracujące ze sobą bez bezpośrednich zależności blokujących</div>

Aplikacja składa się z pięciu kluczowych modułów funkcjonalnych:

| Moduł              | Główne zadania                                                               |
| ------------------ | ---------------------------------------------------------------------------- |
| Discord            | Komendy slash, interakcje i uprawnienia                                      |
| YouTube            | Pamięć podręczna filmów, wykrywanie nowych publikacji i komentarzy           |
| Liczniki statystyk | Subskrypcje, liczba filmów oraz historia wyświetleń                          |
| Notion             | Autoryzacja OAuth dla każdego serwera, kolejka publikacji i dodawanie wpisów |
| Serwer WWW         | Dokumentacja, callback `/notion/oauth/callback` i spójne ekrany komunikatów  |

1. **Moduł Discord (`commands/`, `events/`, `handlers/`):** Obsługuje rejestrację komend slash, uprawnienia administratora, wysyłanie powiadomień w języku polskim oraz interaktywne menu wyboru kanałów i kolumn.
2. **Moduł YouTube (`config/youtube.js`, `services/yt-*.js`):** Odpowiada za odpytywanie YouTube Data API v3, utrzymywanie lokalnego cache filmów i diagnostykę komentarzy.
3. **Moduł Liczników Statystyk (`services/yt-*-counter-monitor.js`):** Odpowiada za periodyczną zmianę nazw kanałów głosowych prezentujących statystyki kanału.
4. **Moduł Notion (`config/notion.js`, `services/notion-*.js`, `utils/notion-*.js`):** Zapewnia niezależne połączenie OAuth per-serwer, szyfrowany magazyn kluczy (AES-256-GCM) oraz asynchroniczne tworzenie wierszy w tabeli Notion.
5. **Moduł Serwera Web (`services/web-server.js`):** Serwuje niniejszą dokumentację oraz obsługuje bezpieczny powrót autoryzacyjny Notion OAuth na wspólnym porcie.

---

## 1.4. Izolacja konfiguracji serwerów Discord (Multi-Tenant per-Guild)

<div class="section-subtitle">Bezpieczna separacja danych wielu serwerów Discord w ramach jednego procesu bota</div>

Pielgrzym obsługuje model multi-tenant, w którym każdy serwer Discord (`guild`) posiada w pełni odizolowaną konfigurację:

- Konfiguracja każdego serwera jest indeksowana jego identyfikatorem `guildId` w pliku `data/guild-config.min.json`.
- Pamięć podręczna filmów i komentarzy jest przypisana ściśle do danego `guildId` w `data/yt-cache.min.json`.
- Poświadczenia Notion są szyfrowane kluczem AES-256-GCM z dołączonym `guildId` jako Authenticated Associated Data (AAD) w `data/notion-auth.min.json`.
- Błąd synchronizacji lub brak uprawnień na jednym serwerze Discord nie wpływa na pozostałe serwery podłączone do bota.

---

## 1.5. Rola pamięci podręcznej i spójność zapisu JSON

<div class="section-subtitle">Ochrona limitów API i bezbłędna serializacja operacji dyskowych</div>

Aby nie marnować limitu zapytań YouTube API (10 000 jednostek dziennie) oraz uniknąć uszkodzenia plików przy nagłym restarcie:

- **Videos Cache:** Bot pobiera listę filmów do pamięci podręcznej. Cykliczny monitoring sprawdza jedynie pierwszą stronę playlisty `Uploads` (1 jednostka API), porównując identyfikatory filmów z cache.
- **Kolejka zapisu (`writeQueue`):** Wszelkie modyfikacje konfiguracji i pamięci podręcznej trafiają do kolejki obietnic, eliminując wyścigi zapisu.
- **Zapis atomowy:** Plik zapisywany jest najpierw pod nazwą tymczasową z identyfikatorem PID procesu, a następnie atomowo podmieniany za pomocą operacji rename systemu operacyjnego.
