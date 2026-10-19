# 5. Liczniki statystyk na kanałach głosowych

<!-- channel: liczniki-glosowe -->

<div class="section-subtitle">Konfiguracja kanałów głosowych Discord jako dynamicznych liczników statystyk kanału</div>

W tym rozdziale opisano mechanizm przekształcania standardowych kanałów głosowych Discorda w automatycznie aktualizowane liczniki statystyk subskrypcji, filmów i wyświetleń.

---

## 5.1. Zasada działania liczników na kanałach głosowych

<div class="section-subtitle">Zmiana nazwy kanału bez wysyłania wiadomości i z poszanowaniem limitów Discorda</div>

Popularną praktyką na serwerach Discord jest tworzenie zablokowanych kanałów głosowych, których nazwa prezentuje aktualne statystyki społeczności. Bot Pielgrzym automatyzuje ten proces:

- **Brak spamu:** Bot nie wysyła żadnych wiadomości na kanał — zmienia jedynie jego nazwę (np. `Subskrypcje: 12,4 tys.`).
- **Ochrona limitu Discord Rate Limit:** Discord zezwala na maksymalnie 2 zmiany nazwy kanału na 10 minut. Bot przed wysłaniem zapytania sprawdza, czy sformatowana nazwa różni się od aktualnej. Jeśli nazwa jest identyczna, zapytanie jest całkowicie pomijane.
- **Odporność na usunięcie:** Jeśli przypisany kanał zostanie usunięty lub bot straci do niego uprawnienia, licznik zostaje automatycznie wyłączony w konfiguracji serwera, a w konsoli pojawia się ostrzeżenie.

---

## 5.2. Licznik subskrypcji (/youtube counter type:subs)

<div class="section-subtitle">Częstotliwość odświeżania, formatowanie zwarte i konfiguracja</div>

Aby ustawić kanał głosowy jako licznik subskrypcji:

```text
/youtube counter type:subs channel:<wybierz kanał głosowy>
```

**Zasada działania:**

- Licznik aktualizuje się **co godzinę** w ramach zadania `update-channel-statistics`.
- Bot pobiera pole `subscriberCount` ze statystyk kanału YouTube.
- Wartość jest formatowana w polskim stylu kompaktowym (np. `Subskrypcje: 15,2 tys.` lub `Subskrypcje: 1,1 mln`).
- Możliwe jest natychmiastowe odświeżenie komendą `/youtube check type:counter-subs`.

---

## 5.3. Licznik filmów (/youtube counter type:videos)

<div class="section-subtitle">Natychmiastowa lokalna inkrementacja oraz okresowa synchronizacja</div>

Aby ustawić kanał głosowy jako licznik liczby filmów:

```text
/youtube counter type:videos channel:<wybierz kanał głosowy>
```

**Zasada działania:**

- Bazowa liczba filmów pochodzi ze statystyk YouTube (`videoCount`).
- **Lokalna inkrementacja:** Gdy zadanie wykrywania nowych filmów (`check-new-videos`) odnajdzie nowy upload, bot natychmiast zwiększa lokalny licznik filmów o 1 i zmienia nazwę kanału bez czekania na dobową synchronizację YouTube.
- **Dobowe uzgodnienie:** O północy czasu pacyficznego bot uzgadnia stan z oficjalną liczbą filmów zwróconą przez YouTube.
- Wartość jest formatowana ze spacją jako separatorem tysięcy (np. `Filmy: 1 245`).

---

## 5.4. Licznik wyświetleń (/youtube counter type:views)

<div class="section-subtitle">Historia dobowa, estymacja roczna oraz wyświetlanie wyświetleń całkowitych</div>

YouTube Data API v3 udostępnia w publicznym obiekcie statystyk wyłącznie łączną sumę wyświetleń od początku istnienia kanału (`viewCount`), a nie liczbę wyświetleń z ostatniego roku. Bot rozwiązuje to za pomocą własnego mechanizmu gromadzenia historii:

```text
/youtube counter type:views channel:<wybierz kanał głosowy>
```

**Algorytm obliczania wyświetleń:**

1. **Zapis dobowy:** Codziennie o północy czasu pacyficznego bot zapisuje do pliku konfiguracyjnego serwera aktualny stan wyświetleń z datą UTC `YYYY-MM-DD` w tablicy `viewsHistory` (przechowuje do 366 wpisów).
2. **Faza początkowa (< 30 dni historii):**
   - Dopóki bot nie zgromadzi co najmniej 30 dni historii, kanał wyświetla łączną liczbę wyświetleń kanału (np. `Wyświetlenia: 3,4 mln`).
3. **Faza estymacji średniej (30 – 364 dni historii):**
   - Bot oblicza przyrost wyświetleń pomiędzy najstarszym a najnowszym wpisem i wyznacza średnią dzienną:
     $$\text{Średnia dzienna} = \frac{\text{Wyświetlenia}_\text{nowe} - \text{Wyświetlenia}_\text{stare}}{\text{Dni}}$$
   - Następnie mnoży wynik przez 365, podając estymowaną roczną liczbę wyświetleń.
4. **Faza pełnej historii rocznej (>= 365 dni historii):**
   - Bot odnajduje wpis sprzed 365 dni i odejmuje go od stanu bieżącego, prezentując rzeczywistą liczbę wyświetleń z ostatnich 12 miesięcy.

---

## 5.5. Wymagane uprawnienia i wyłączanie liczników

<div class="section-subtitle">Uprawnienia niezbędne do modyfikacji kanałów i procedura bezpiecznego wyłączenia</div>

### Wymagane uprawnienia bota na kanale głosowym

Podczas konfiguracji komenda `/youtube counter` automatycznie sprawdza, czy bot posiada uprawnienia:

- **Wyświetlanie kanału (`ViewChannel`)**
- **Łączenie (`Connect`)**
- **Zarządzanie kanałami (`ManageChannels`)**

Jeśli któregoś z nich brakuje, bot odrzuca konfigurację z czytelnym komunikatem wskazującym brakujące uprawnienie.

### Wyłączenie wybranego licznika

Aby wyłączyć konkretny licznik i przywrócić domyślną nazwę kanału:

```text
/youtube disable counter:subs
/youtube disable counter:views
/youtube disable counter:videos
```

Bot usunie wpis z konfiguracji serwera i zmieni nazwę kanału na neutralną (odpowiednio `Subskrypcje`, `Wyświetlenia` lub `Filmy`). Wyłączenie pojedynczego licznika nie wpływa na pozostałe liczniki ani na powiadomienia tekstowe.
