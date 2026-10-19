# Polityka bezpieczeństwa

Pielgrzym to pojedyncza aplikacja wdrażana z gałęzi `master`. Aktywne poprawki bezpieczeństwa dotyczą wyłącznie najnowszego opublikowanego wydania.

## Zakres bezpieczeństwa

- Proces bota (Discord gateway, cron harmonogramy, publikator Notion).
- Wbudowany serwer Express (`services/web-server.js`) serwujący dokumentację, przewodnik komend `/commands`, endpoint `/search-index.json` oraz adres zwrotny OAuth `/notion/oauth/callback`.
- Lokalne pliki konfiguracji i cache w katalogu `data/` oraz plik `.env`.

## Dane poufne

- Plik `.env` (tokeny Discord, klucz YouTube Data API v3, poświadczenia OAuth Notion, 32-bajtowy klucz szyfrowania AES-256-GCM) jest ignorowany przez Git. Nie zapisuj realnych wartości do kodu, logów, zrzutów ekranu ani zgłoszeń.
- `data/notion-auth.min.json` przechowuje szyfrowane tokeny Notion z guild ID jako AAD. Utrata klucza `NOTION_TOKEN_ENCRYPTION_KEY` wymusza ponowną autoryzację każdego serwera.
- Serwer Express wysyła nagłówki `Content-Security-Policy` (`default-src 'none'`, `script-src 'self'`, `connect-src 'self'`, czcionki Google), `X-Content-Type-Options: nosniff` i `Referrer-Policy: no-referrer`. Trasy nie serwują `data/`, `.env` ani `AGENTS.md`.
- Adres zwrotny OAuth musi być wystawiony przez HTTPS reverse proxy z wyłączonym logowaniem parametrów zapytania.

## Zgłaszanie podatności

Jeżeli znajdziesz lukę bezpieczeństwa, wyślij prywatną wiadomość na adres <jakub@klalo.pl>. Nie publikuj szczegółów w publicznych zgłoszeniach GitHub.

W zgłoszeniu podaj minimalny scenariusz odtworzenia, wpływ i proponowaną korektę. Potwierdzenie otrzymasz w ciągu kilku dni roboczych; wydanie poprawki następuje możliwie najszybciej.
