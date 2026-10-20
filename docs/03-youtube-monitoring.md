# 3. Monitorowanie kanału YouTube i pamięć podręczna filmów

<!-- channel: monitorowanie-youtube -->

<div class="section-subtitle">Przypisywanie kanału YouTube do serwera, cache wideo, harmonogramy i obsługa limitów API</div>

W tym rozdziale szczegółowo omówiono mechanizm powiązania kanału YouTube z serwerem Discord, zarządzanie lokalną pamięcią podręczną filmów oraz zasady działania zadań cyklicznych w tle.

---

## 3.1. Zasada przypisywania kanału YouTube do serwera Discord

<div class="section-subtitle">Wyszukiwanie kanału, zapis konfiguracji i domyślny kanał tekstowy powiadomień</div>

Każdy serwer Discord może monitorować jeden wybrany kanał YouTube. Aby włączyć monitorowanie, administrator serwera wpisuje w wybranym kanale tekstowym:

```text
/youtube enable channel-name:<nazwa lub @uchwyt>
```

**Algorytm działania komendy:**

1. Bot sprawdza, czy użytkownik ma uprawnienia administratora lub jest zdefiniowanym właścicielem (`OWNER_ID`).
2. Jeśli monitorowanie było już aktywne, zostaje wyłączone, a dotychczasowa pamięć podręczna kanału wyczyszczona.
3. Bot czyści parametr z ewentualnego przedrostka `@` i przeszukuje YouTube Data API v3:
   - Najpierw po parametrze `forHandle` (nowy format uchwytów YouTube, np. `@twoj-kanal`).
   - Jeśli nie znaleziono, ponawia zapytanie po parametrze `forUsername` (starsze nazwy użytkowników).
4. Po znalezieniu kanału pobiera jego identyfikator (`channelId`), tytuł, miniaturę oraz aktualne statystyki (subskrypcje, wyświetlenia, filmy).
5. Zapisuje czas rozpoczęcia monitorowania (`setupDate = Date.now()`). Zapobiega to wysyłaniu powiadomień o filmach opublikowanych przed tą datą.
6. Kanał tekstowy, w którym wywołano komendę, zostaje automatycznie zapisany jako domyślny kanał zarówno dla nowych filmów (`newVideosChannelId`), jak i dla komentarzy (`activityChannelId`).
7. Bot pobiera kompletną listę dotychczasowych filmów do lokalnego cache (`refreshVideosCache`).

---

## 3.2. Mechanizm pamięci podręcznej filmów (videosCache)

<div class="section-subtitle">Optymalizacja zapytań API i niezawodne wykrywanie nowych uploadów</div>

Zamiast ciągłego przeszukiwania zasobów wyszukiwarką `search.list` (która kosztuje aż 100 jednostek limitu za zapytanie), bot stosuje zoptymalizowany mechanizm oparty na playliście przesłanych filmów:

- **Konwersja identyfikatora:** Z identyfikatora kanału zaczynającego się od `UC` bot tworzy identyfikator playlisty `Uploads`, podmieniając prefiks na `UU`.
- **Zapytanie za 1 jednostkę:** Pobranie playlisty przez `playlistItems.list` kosztuje tylko **1 jednostkę limitu** i zwraca filmy posortowane od najnowszego.
- **Weryfikacja nowości:** Bot porównuje identyfikatory z pierwszej strony playlisty z identyfikatorami zapisanymi w `videosCache`. Filmy, których nie ma w cache i których data publikacji jest późniejsza niż `setupDate`, są traktowane jako nowe publikacje.
- **Kolejność powiadomień:** Nowe filmy wysyłane są na Discord w kolejności od najstarszego do najnowszego (chronologicznie), po czym zostają dopisane na początek `videosCache`.

---

## 3.3. Wewnętrzne harmonogramy cron

<div class="section-subtitle">Zadania cykliczne realizowane w procesie bota w strefie czasowej America/Los_Angeles</div>

Harmonogramy sterowane są przez bibliotekę `node-cron` wewnątrz procesu Node.js. Wszystkie interwały przeliczane są względem strefy `America/Los_Angeles` (czas pacyficzny, w którym resetuje się limit Google):

| Interwał (czas pacyficzny) | Nazwa zadania               | Wykonywane operacje                                                                                                           |
| :------------------------- | :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `*/10 * * * *` (co 10 min) | `check-new-videos`          | Odczyt pierwszej strony playlisty przesłanych filmów, wysyłka powiadomień na Discord, planowanie podsumowania po 45 minutach. |
| `*/30 * * * *` (co 30 min) | `check-new-comments`        | Skanowanie aktywnych filmów (do 60 dni lub 100 najnowszych) w poszukiwaniu nowych komentarzy i odpowiedzi.                    |
| `0 4 * * *` (04:00 PT)     | `refresh-videos-cache`      | Pobranie wszystkich stron playlisty przesłanych materiałów i pełne odświeżenie pamięci podręcznej filmów.                     |
| `0 9 * * *` (09:00 PT)     | `diagnose-old-videos`       | Weryfikacja statystyk starszych filmów i skanowanie tylko tych, w których zmieniła się liczba komentarzy lub najnowszy wpis.  |
| `0 * * * *` (co godzinę)   | `update-channel-statistics` | Pobranie aktualnych statystyk kanału z YouTube i aktualizacja nazwy kanału głosowego z subskrypcjami.                         |
| O północy (00:00 PT)       | Gałąź dzienna statystyk     | Zapis dziennego punktu w historii wyświetleń oraz aktualizacja liczników wyświetleń i filmów.                                 |

> **Blokada nakładania (`noOverlap: true`):** Jeśli poprzednie wywołanie danego zadania jeszcze się nie zakończyło, kolejne uruchomienie zostaje pominięte, co zapobiega kumulacji zapytań sieciowych.

---

## 3.4. Monitorowanie komentarzy i diagnostyka starszych filmów

<div class="section-subtitle">Dwupoziomowy algorytm skanowania dyskusji z poszanowaniem budżetu zapytań</div>

1. **Aktywne filmy (co 30 minut):**
   - Za aktywne uznawane są filmy opublikowane w ciągu ostatnich **60 dni** LUB znajdujące się wśród **100 najnowszych** pozycji w cache.
   - Dla każdego aktywnego filmu bot pobiera wątki komentarzy (`commentThreads.list`).
   - Jeśli ostatni identyfikator na stronie był już widziany w sesji bazowej, paginacja jest przerywana.
   - Nowe komentarze wysyłane są na kanał powiadomień w kolejności chronologicznej.
   - Pamięć zapamiętuje do 10 000 najnowszych identyfikatorów komentarzy (`seenComments`).

2. **Starsze filmy (raz dziennie o 09:00 PT):**
   - Filmy starsze niż 60 dni i poza pierwszą setką są sprawdzane grupowo po 50 identyfikatorów za pomocą `videos.list`.
   - Bot porównuje aktualną liczbę komentarzy z zapisaną w metadanych `videosMeta`.
   - Dopiero gdy liczba komentarzy się różni (lub zmienił się identyfikator najnowszego komentarza), uruchamiane jest szczegółowe skanowanie danego filmu.

---

## 3.5. Dzienny limit YouTube Data API v3 i reset w strefie Pacific

<div class="section-subtitle">Ekonomia zapytań i zachowanie w przypadku wyczerpania dziennego limitu</div>

Google przydziela bezpłatny limit **10 000 jednostek dziennie** na projekt w Google Cloud. Wszystkie metody odczytu (`.list`) stosowane przez bota kosztują **1 jednostkę** za stronę:

- Przykładowy koszt bazowy dla 1 serwera, 214 filmów (100 aktywnych i 114 starszych), wszystkich liczników i powiadomień oraz jednej strony wyników na film to około **5 090 jednostek na zwykłą dobę**. To szacunek bez ponowień, dodatkowych stron i ręcznych kontroli, nie gwarancja zmieszczenia się w limicie.
- **Brak lokalnego limitu:** Bot wykorzystuje przydział Google bez własnego dziennego licznika. Błąd `quotaExceeded` / `dailyLimitExceeded` kończy bieżący skan. Kolejne zaplanowane przebiegi nadal mogą próbować odczytu; nie ma trwałej blokady do resetu.
- **Reset limitu:** Limit resetuje się o **00:00 czasu pacyficznego** (`America/Los_Angeles`), co w Polsce odpowiada godzinie 09:00 (lub 08:00 podczas rozbieżności czasu letniego/zimowego). Po tej godzinie zapytania automatycznie zaczynają przechodzić pomyślnie.

Każda dodatkowa strona komentarzy lub odpowiedzi, ponowienie żądania, ręczna kontrola i podsumowanie filmu zwiększa koszt. Więcej niż 100 filmów opublikowanych w ostatnich 60 dniach zwiększa liczbę aktywnych pozycji. Limit jest wspólny dla projektu Google, a rzeczywiste zużycie sprawdza się w Cloud Console.

## 3.6. Ręczne sterowanie i ograniczenia wykrywania

- `/youtube status [ephemeral:true]` pokazuje stan monitoringu, kanałów i liczników.
- `/youtube check` uruchamia wybraną kontrolę filmów, komentarzy lub licznika; typy opisano w rozdziale o kanałach powiadomień.
- `/youtube disable` bez opcji wyłącza monitoring i czyści cache YouTube tego serwera. Notion zachowuje swoją kolejkę, ale wstrzymuje dostarczanie przy nieaktywnym monitoringu.
- Ponowne `/youtube enable` wyłącza dotychczasowy monitoring **przed** sprawdzeniem nowego kanału. Nieprawidłowa nazwa nie przywraca automatycznie starej konfiguracji.

Skan wątków i pobieranie odpowiedzi mają limit po 10 stron, po maksymalnie 100 pozycji. Odpowiedzi pominięte w danych wątku są pobierane osobno, ale nowe odpowiedzi do starych wątków za granicą wcześniejszego zakończenia skanu mogą pozostać niewykryte. Niezmieniona łączna liczba komentarzy nie dowodzi braku zmian we wszystkich odpowiedziach.

Identyfikatory widzianych komentarzy są zapisywane przed wysyłką powiadomień. Nieudana wysyłka Discord może więc utracić powiadomienie; nie ma trwałej kolejki dostarczenia. Historia 10 000 ID jest skończona. Monitoring filmów czyta tylko 50 najnowszych pozycji — długa przerwa lub duża liczba publikacji może pozostawić luki.

Podsumowania po 45 minutach korzystają z nietrwałych timerów: restart je usuwa. Gdy nowo wykryty film ma już ponad 45 minut, podsumowanie jest planowane od razu. Harmonogramy to docelowe częstotliwości, nie gwarantowany czas dostarczenia.
