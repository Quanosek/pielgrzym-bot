# 4. Kanały powiadomień tekstowych i ich rozdzielenie

<!-- channel: kanaly-powiadomien -->

<div class="section-subtitle">Domyślne kanały powiadomień, dostosowywanie i rozdzielanie filmów od komentarzy</div>

Rozdział ten opisuje sposób zarządzania kanałami tekstowymi, na które bot wysyła powiadomienia o nowych publikacjach oraz komentarzach, w tym procedurę ich rozdzielenia na dwa niezależne kanały.

---

## 4.1. Domyślny kanał powiadomień po aktywacji monitoringu

<div class="section-subtitle">Zachowanie początkowe po użyciu komendy /youtube enable</div>

W momencie aktywacji monitorowania za pomocą:

```text
/youtube enable channel-name:<nazwa>
```

kanał tekstowy Discorda, w którym administrator wywołał powyższą komendę, staje się **wspólnym domyślnym kanałem** dla obu typów powiadomień:

- `newVideosChannelId`: identyfikator kanału dla powiadomień o nowych filmach.
- `activityChannelId`: identyfikator kanału dla powiadomień o komentarzach i dyskusjach.

Dla mniejszych serwerów prowadzenie obu rodzajów powiadomień w jednym kanale może być wystarczające. Jednak na większych serwerach komentarze pojawiają się znacznie częściej niż filmy, co może powodować przesyt powiadomień i utrudniać zauważenie nowo opublikowanego filmu.

---

## 4.2. Rozdzielenie kanałów powiadomień tekstowych

<div class="section-subtitle">Konfiguracja niezależnych kanałów w panelu /youtube settings</div>

Aby rozdzielić powiadomienia o filmach od powiadomień o komentarzach, administrator serwera używa komendy:

```text
/youtube settings
```

Bot wyświetla prywatne (ephemeral) menu komponentów Discord V2 z listą rozwijanych selektorów kanałów:

1. **Powiadomienia o nowych filmach (`newVideosChannelId`):**
   - Wybierz dedykowany kanał tekstowy (np. `#nowe-filmy` lub `#aktualnosci`).
   - W tym kanale będą publikowane wyłącznie główne informacje o opublikowanych filmach oraz podsumowania statystyk po 45 minutach od premiery.
2. **Powiadomienia o nowych komentarzach (`activityChannelId`):**
   - Wybierz osobny kanał tekstowy (np. `#dyskusje-yt`, `#komentarze-youtube` lub kanał moderacyjny).
   - W tym kanale będą pojawiać się cytaty nowych komentarzy, autorzy oraz powiązania z odpowiednimi filmami.
3. **Selektory liczników:**
   - Panel umożliwia również przypisanie kanałów głosowych dla liczników (omówione w Rozdziale 5).

> Zmiana kanału dla nowych filmów nie zmienia automatycznie kanału komentarzy i odwrotnie — każde ustawienie jest w pełni niezależne.

---

## 4.3. Formatowanie i treść powiadomień na Discordzie

<div class="section-subtitle">Bogate embedy w języku polskim, miniatury i linki bezpośrednie</div>

Bot publikuje powiadomienia w postaci sformatowanych kart (embedów Discord) w języku polskim:

### Powiadomienie o nowym filmie

- **Nagłówek:** Nazwa kanału YouTube z miniaturą awatara kanału.
- **Tytuł embeda:** `Opublikowano nowy film! 🎬` z bezpośrednim linkiem do filmu (`https://www.youtube.com/watch?v=...`).
- **Opis:** Pełny, zdekodowany z encji HTML tytuł filmu.
- **Miniatura:** Duża grafika okładki filmu pobrana z YouTube.
- **Pola:** Sformatowany relatywny znacznik czasu publikacji Discorda (`<t:timestamp:f>`).
- **Podsumowanie po 45 minutach:** Jeśli film nie jest archiwalny, bot po 45 minutach wysyła dodatkowe podsumowanie z liczbą wyświetleń, polubień i pierwszych komentarzy.

### Powiadomienie o nowym komentarzu

- **Nagłówek:** Tytuł filmu, pod którym pojawił się komentarz.
- **Tytuł embeda:** `Nowy komentarz od: <Autor>` z linkiem do filmu.
- **Treść:** Zdekodowana treść komentarza z zachowaniem limitów znaków Discorda (do 4096 znaków).
- **Znak czasu:** Dokładna data publikacji komentarza.

---

## 4.4. Weryfikacja stanu konfiguracji

<div class="section-subtitle">Komendy diagnostyczne /youtube status oraz /youtube check</div>

Administrator serwera może w każdej chwili sprawdzić i przetestować konfigurację kanałów:

### Sprawdzenie stanu (`/youtube status`)

```text
/youtube status ephemeral:true
```

Wyświetla kartę informacyjną zawierającą:

- Nazwę i link do aktualnie monitorowanego kanału YouTube.
- Liczbę aktywnych kanałów powiadomień (`X / 2`) wraz z oznaczeniami kanałów (`<#id>`).
- Liczbę aktywnych liczników statystyk (`X / 3`).
- Datę rozpoczęcia monitorowania na serwerze.

### Natychmiastowe wymuszenie sprawdzenia (`/youtube check`)

Komenda `/youtube check` obsługuje pięć typów natychmiastowych wywołań odpowiadających zadaniom cyklicznym:

```text
/youtube check type:notifications-videos   # Pobierz pierwszą stronę przesłanych filmów
/youtube check type:notifications-activity # Zeskanuj aktywne filmy pod kątem nowych komentarzy
/youtube check type:counter-subs           # Odśwież statystyki i nazwę licznika subskrypcji
/youtube check type:counter-views          # Przelicz historię i zaktualizuj licznik wyświetleń
/youtube check type:counter-videos         # Zsynchronizuj licznik filmów ze statystykami YouTube
```

Pozwala to szybko potwierdzić poprawność konfiguracji bez oczekiwania na najbliższy cykl harmonogramu cron (opisany w rozdziale 3.3).

---

## 4.5. Wymagane uprawnienia bota na kanałach tekstowych

<div class="section-subtitle">Niezbędne uprawnienia roli bota do poprawnego wysyłania wiadomości</div>

Aby powiadomienia docierały bez przeszkód, rola bota musi posiadać na wybranych kanałach tekstowych następujące uprawnienia:

- **Wyświetlanie kanału (`ViewChannel`)**
- **Wysyłanie wiadomości (`SendMessages`)**
- **Wstawianie linków i embedów (`EmbedLinks`)**
- **Dołączanie plików (`AttachFiles`)**

Brak uprawnienia `EmbedLinks` uniemożliwi botowi poprawne wyrenderowanie karty powiadomienia, a błąd zostanie odnotowany w konsoli bota bez zakłócania działania pozostałych modułów.
