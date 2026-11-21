# Plakaty Parafialne

Aplikacja desktopowa dla kancelarii **Parafii pw. św. Jakuba Apostoła w Koziebrodach** (Diecezja Płocka, Sanktuarium Matki Bożej Królowej Nieba). Przygotowuje plakaty i ogłoszenia dla parafian z pomocą agenta AI (Claude), z oficjalnym logo, zdjęciami i motywami religijnymi parafii.

Linux (AppImage) i Windows (wersja przenośna .exe). Wygląd w stylu macOS/iOS, tryb jasny i ciemny, interfejs po polsku.

## Co potrafi

- **Generowanie plakatów przez AI** – wpisujesz najważniejsze informacje (data, godzina, szczegóły), agent pisze treść poprawną liturgicznie, dobiera układ, kolory, motyw i zdjęcie. Od razu dostajesz 1–4 warianty do wyboru. Agent nie zmyśla godzin ani nazwisk: braki wypisuje osobno.
- **Presety tematyczne** (26 wbudowanych, w 4 kategoriach: święta i okresy liturgiczne, sakramenty i okoliczności, wydarzenia i imprezy, ogłoszenia). Każdy preset to kolory, czcionki, układ, ramka, motyw, zdjęcie, cytat z Pisma Świętego i wskazówki dla AI. Każdy można skopiować i dopasować („Dopasuj”) albo stworzyć własny.
- **Oficjalne oznaczenia parafii** – logo (z wyciętym tłem), emblemat kościoła, logo na karcie, dwa zdjęcia obrazu Matki Bożej i widok kościoła. Własne logo i zdjęcia dodaje się przeciągnięciem pliku. Logo na plakacie można przekolorować (np. na biało na zdjęciu).
- **27 wektorowych motywów religijnych** (krzyże, Chi-Rho, IHS, gołębica, gwiazda betlejemska, muszla św. Jakuba, kielich, monstrancja, korona Królowej Nieba, lilia, różaniec, kłosy, palma, świeca, wieniec adwentowy i inne) oraz ozdobniki i ramki.
- **Edytor plakatów** – przeciąganie i skalowanie elementów z przyciąganiem do środka i krawędzi, edycja tekstu podwójnym kliknięciem, warstwy (ukrywanie, blokowanie, kolejność), cofanie/ponawianie, kopiowanie, szybka zmiana palety kolorów i czcionek całego plakatu, zmiana układu i formatu, tło, ramka, kody QR, harmonogramy. Pole **„Popraw poleceniem”** – np. „zmień godzinę na 18:00 i dodaj, że spowiedź od 17:30” – AI wprowadza zmiany w plakacie.
- **Kalendarz świąt** – kalendarz liturgiczny Kościoła w Polsce liczony lokalnie (Wielkanoc, Popielec, Boże Ciało, Adwent, uroczystości, święta polskie, nabożeństwa majowe/różańcowe, kolęda…), kolory liturgiczne, święta parafii (odpust 25 lipca, uroczystość MB Częstochowskiej – lista do edycji), własne wydarzenia.
- **Agent w tle + internet** – co godzinę sprawdza kalendarz i z wyprzedzeniem proponuje plakaty (powiadomienia systemowe, działa z zasobnika). Co kilka dni przegląda monitorowane strony (domyślnie diecezjaplocka.pl i plock.gosc.pl – lista w ustawieniach) i wyszukiwarkę w poszukiwaniu wydarzeń parafii, sanktuarium i diecezji. Opcjonalnie sam przygotowuje szkice.
- **Druk** – wybór drukarki, liczba kopii, papier (A3/A4/A5/Letter lub automatycznie), 1/2/4/8 plakatów na kartce (ulotki), dopasowanie lub rzeczywisty rozmiar, druk czarno-biały, margines, znaczniki cięcia, podgląd arkusza. Eksport do **PDF** (czcionki osadzone – dla drukarni), **PNG** (Facebook, strona, telewizor w kościele) i projektu `.json`.
- **Formaty**: A4/A3 pion i poziom, A5, A6, plakat 50×70 cm, kwadrat (social media), ekran 16:9.
- **Wysoka konfigurowalność** – dane parafii, szablon stopki, święta parafialne, ton i stałe zalecenia dla AI, domyślny format/preset/liczba wariantów, kod QR, ustawienia druku, częstotliwość i źródła monitorowania internetu, kategorie kalendarza, motyw.

## Połączenie z Claude

Domyślnie aplikacja korzysta z konta Claude użytkownika przez oficjalny program **Claude Code** (instalowany jednym kliknięciem w *Ustawienia → Claude*, logowanie na stronie Claude – aplikacja nie widzi hasła). W ustawieniach zaawansowanych można zamiast tego podać klucz API (platform.claude.com). Bez połączenia aplikacja działa dalej: plakaty powstają z presetów, edytor, kalendarz i druk działają normalnie.

## Kompilacja (GitHub Actions)

Wrzuć zawartość tego katalogu do repozytorium na GitHubie (gałąź `main`). Workflow `.github/workflows/build.yml`:

- przy każdym pushu: testy → **Linux AppImage** + **Windows portable .exe** (pobierasz z zakładki *Actions* → przebieg → *Artifacts*),
- przy tagu `v*` (np. `git tag v1.0.0 && git push --tags`) – dodatkowo **Release** z plikami.

Lokalnie: `npm ci`, `npm start`, `npm test`, `npm run dist:linux`, `npm run dist:win`.

## Dane

Plakaty (każdy w osobnym pliku JSON), własne grafiki i ustawienia leżą w folderze danych (w wersji przenośnej – obok pliku .exe, w folderze „Plakaty Parafialne - dane”). Kopia tego folderu = kopia wszystkiego. Usunięte plakaty trafiają do podfolderu `kosz`.

## Struktura

```
src/main/        proces główny: okno, IPC, agent, kalendarz liturgiczny, AI, druk/eksport, dane
src/shared/      model plakatu (formaty, palety, czcionki, motywy SVG, silnik układu, render) i presety
src/renderer/    interfejs: pulpit, kreator, edytor, biblioteka, kalendarz, presety, grafiki, ustawienia
src/assets/      ikona i oficjalne grafiki parafii
test/            testy logiki (node test/run-tests.js)
```

Zbudowano na wzorcu z0z6/dziennik (Electron, czysty JS, electron-builder).
