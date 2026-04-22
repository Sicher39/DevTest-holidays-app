# Holidays App


Holidays App je jednoduchá aplikace pro evidenci a schvalování žádostí o dovolenou postavená na Vue 3, Vite a Vuetify.

Projekt běží čistě nad mock službami ve `src/services/mock/` a JSON seed daty v `api/`. Samostatný backend ani serverová API vrstva se nepoužívají.

## Stack

- Vue 3 + Vite
- TypeScript
- Vuetify
- Vue Router
- Tailwind CSS
- Vitest
- ESLint

## Spuštění

```bash
pnpm install
pnpm dev
```

Vývojová aplikace běží přes Vite standardně na `http://localhost:3000`.

## Data

- Seed data jsou v adresáři `api/`.
- Mock služby jsou v `src/services/mock/`.
- Žádosti se při práci v UI ukládají do `localStorage`, takže změny přežijí reload stránky.

## Dostupné skripty

```bash
pnpm dev
pnpm build
pnpm preview
pnpm build-only
pnpm type-check
pnpm lint
pnpm lint:fix
pnpm test
pnpm test:watch
pnpm mcp
pnpm mcp:revert
```

## Testy

Projekt používá `Vitest` pro unit testy service vrstvy.

```bash
pnpm test
pnpm test:watch
```

Aktuálně jsou pokryté tyto scénáře:

- vytvoření nové žádosti
- úprava existující žádosti
- validace zamítnutí bez důvodu

## Struktura projektu

```text
.
├─ api/                 # JSON seed data
├─ src/
│  ├─ components/       # znovupoužitelné Vue komponenty
│  ├─ composables/      # sdílená logika
│  ├─ pages/            # routované stránky
│  ├─ router/           # Vue Router
│  ├─ services/mock/    # mock služby
│  ├─ styles/           # globální styly
│  ├─ types/            # TypeScript typy
│  └─ utils/            # pomocné utility
└─ package.json
```
