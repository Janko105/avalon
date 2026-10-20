# Avalon – jedan telefon

Društvena igra Avalon za 5–10 igrača na jednom telefonu koji se dodaje u krugu. Statičan sajt, bez backenda, radi i offline (PWA).

- Tajna podela uloga: Merlin, Ubica, Persival, Morgana, Mordred, Oberon, lojalni sluge i Mordredove sluge
- Izbor tima i tajno glasanje na misiji (dobri ne mogu da glasaju „Pada”)
- Tabla misija, 2 „Pada” na 4. misiji kod 7+ igrača, automatski kraj
- Gospa od Jezera, ubistvo Merlina, podsetnik uloge iz menija

## Lokalno

```sh
python -m http.server 8000
```

Otvori `http://localhost:8000`. (Preko `file://` ne radi, jer koristi JS module.)

## Testovi

```sh
node --test tests/rules.test.mjs
```

## Objavljivanje na GitHub Pages

1. Napravi repo na GitHubu i pushuj ovaj folder na `main`.
2. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Na telefonu otvori dobijeni link i izaberi „Add to Home screen”.

Kad menjaš fajlove, povećaj `CACHE` u `sw.js` (npr. `avalon-v2`) da bi telefoni povukli novu verziju.
