# Pamo App — Frontend

Frontend React + Vite de **Pamo** (marketplace). Consume la API del backend
(`Pamo_app_back`) vía axios, con las pantallas organizadas por área de
negocio (Accesos, Productos, Logística, Facturación, etc.), reflejando las
mismas áreas que existen del lado del backend.

Repo hermano: **backend** en [`Pamo_app_back`](https://github.com/maperezrf/Pamo_app_back)
(Django REST Framework). Backend y frontend son repos separados que se
despliegan de forma independiente.

**Antes de escribir código, leer [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md)**
— reglas de arquitectura, estructura por áreas, cliente HTTP y el contrato
con el backend. Es de lectura obligatoria tanto para quien programa a mano
como para quien dirige el desarrollo con IA.

## Stack

- React 19 + Vite
- `@react-oauth/google` (login con Google)
- axios (cliente HTTP único hacia el backend — ver `docs/GOVERNANCE.md` §4)
- `oxlint`

## 1. Credenciales de Google OAuth

Se generan una sola vez desde el repo de backend (ver su README, sección de
Google Cloud Console). El mismo **Client ID** se usa en los dos repos:
acá va en `frontend/.env` → `VITE_GOOGLE_CLIENT_ID`.

## 2. Levantar el frontend

```bash
cp .env.example .env            # completar VITE_API_BASE_URL y VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

Queda en `http://localhost:5173`. Necesita el backend corriendo en paralelo
(`http://127.0.0.1:8000` por defecto en local) — ver el README de
`Pamo_app_back`.

## 3. Variables de entorno

- `VITE_API_BASE_URL` — URL base de la API del backend.
- `VITE_GOOGLE_CLIENT_ID` — mismo Client ID configurado en el backend.

Todo lo que empiece con `VITE_` termina público en el bundle del navegador
— nunca poner un secreto real ahí (ver `docs/GOVERNANCE.md` §6).

## Comandos

```bash
npm run dev       # desarrollo
npm run build     # build de producción
npm run preview   # previsualizar el build
npm run lint      # oxlint
```

Ver `docs/GOVERNANCE.md` §3 para en qué área va cada pantalla nueva, §4
para el cliente HTTP, y §7 para el contrato con el backend (manejo de
errores, endpoints públicos, CORS/cookies entre dominios).
