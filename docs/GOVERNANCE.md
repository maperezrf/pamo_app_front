# Governance de Pamo App — Frontend

> Reglas de arquitectura, patrones y flujo de trabajo para este repositorio
> (`pamo_app_front`, React + Vite) — humano o agente de IA. El objetivo es
> que el resultado sea el mismo sin importar quién (o qué modelo) escribió
> el código. Cuando una regla de aquí choque con una preferencia puntual de
> una tarea, esta guía gana salvo decisión explícita en contrario del
> equipo, documentada en la sección 11.
>
> El backend (`Pamo_app_back`, Django + DRF) tiene su propio
> `docs/GOVERNANCE.md` con las reglas equivalentes de su lado. Los
> principios generales (§2), la tabla de áreas de negocio (§3) y el
> contrato de API (§7) deben mantenerse consistentes entre los dos repos —
> si algo de eso cambia acá, se actualiza también en `Pamo_app_back`.

## 1. Cómo usar este documento

Este documento tiene dos lectores distintos, y el objetivo es que ambos
lleguen al mismo resultado:

- **El desarrollador**: conoce patrones de React, componentes, estado,
  consumo de APIs — puede leer un diff y notar cuándo una IA se desvió de
  una convención.
- **El vibecoder**: dirige el desarrollo completamente a través de
  instrucciones a una IA, sin necesariamente leer el código línea por línea.

Para que el resultado no dependa de quién pidió el cambio, la regla es
simple: **toda funcionalidad nueva se le pide a la IA citando este
documento como contexto obligatorio** ("tenés que seguir
`docs/GOVERNANCE.md`") y, antes de dar por cerrada una tarea, se revisa
contra el checklist de la sección 10 — está escrito para poder revisarse
sin saber programar.

## 2. Principios generales

1. **Cambios mínimos y quirúrgicos.** Una tarea resuelve una tarea. No
   aprovechar un pedido para refactorizar algo no solicitado. Esto importa
   el doble cuando quien aprueba el cambio no va a leer el código línea por
   línea: un diff enfocado es revisable con el checklist de la sección 10;
   uno que tocó cinco pantallas no relacionadas, no.
2. **Aditivo por defecto.** Una funcionalidad nueva no elimina, oculta ni
   degrada pantallas, acciones o datos existentes sin que se haya pedido
   explícitamente. Si algo se rompe, primero se recupera la versión anterior
   desde Git — no se reconstruye de memoria.
3. **La interfaz nunca es la barrera de seguridad — ni siquiera del lado del
   frontend.** Este repo no puede ver el código del backend ni confiar en
   que "ya se validó allá": ocultar un botón o deshabilitar una acción es
   una ayuda de UX, nunca la razón por la que algo es seguro. El backend es
   quien rechaza (401/403) lo que no corresponde — el frontend solo evita
   mostrarle al usuario una acción que de todos modos le va a fallar.
4. **Una sola fuente de verdad por concepto.** La configuración del cliente
   HTTP, el registro de áreas/rutas y el manejo de la sesión no pueden vivir
   duplicados en dos archivos. Si hace falta usarlo en dos lugares, se
   importa, no se copia.
5. **No hay código muerto.** Nada de componentes, imports o rutas
   comentadas "por si acaso". Si no se usa, se borra (Git conserva el
   historial).
6. **Español para negocio, inglés para lo técnico genérico**: texto de UI,
   nombres de props/estado de dominio en español cuando reflejan un
   concepto de negocio (`pedido`, `numeroGuia`); nombres técnicos genéricos
   (`props`, `state`, `handleSubmit`) en inglés. No mezclar dentro de un
   mismo identificador.

## 3. Organización: pantallas por área de negocio

Pamo es un marketplace: la operación se divide naturalmente en áreas de
negocio (Logística, Facturación, Publicaciones, Productos, Pedidos,
Contraentrega, Accesos y Seguridad, etc.). El frontend se organiza
reflejando las mismas áreas que ya existen en el backend — **esta tabla
debe ser idéntica a la del backend** (`Pamo_app_back/docs/GOVERNANCE.md`
§3.2); si cambia allá, se replica acá en el mismo ciclo de trabajo.

| Área | Carpeta frontend | Prefijo API que consume | Responsabilidad | Estado |
|---|---|---|---|---|
| Accesos y Seguridad | `areas/accesos` | `/api/auth/` | Login, pantalla de no autorizado, sesión | Activa |
| Productos y Catálogo | `areas/productos` | `/api/productos/` | Catálogo maestro, precios, márgenes | Pendiente |
| Publicaciones | `areas/publicaciones` | `/api/publicaciones/` | Publicar/sincronizar catálogo en canales | Pendiente |
| Pedidos | `areas/pedidos` | `/api/pedidos/` | Captura, estados y trazabilidad de pedidos | Pendiente |
| Logística | `areas/logistica` | `/api/logistica/` | Fulfillment, guías de envío, tracking | Pendiente |
| Facturación | `areas/facturacion` | `/api/facturacion/` | Facturas, remisiones contables | Pendiente |
| Contraentrega (COD) | `areas/contraentrega` | `/api/contraentrega/` | Elegibilidad y gestión de pago contra entrega | Pendiente |
| Configuración e Integraciones | `areas/configuracion` | `/api/configuracion/` | Estado de conexiones externas, ambientes | Pendiente |
| Feature Tracking y Migraciones | `areas/feature_tracking` | `/api/tracking/` | Panel de features, estado, dependencias (consume el módulo de tracking del backend) | Pendiente — el backend ya lo tiene activo (registro automático vía webhook), acá falta la pantalla |

**Flujo al pedir una pantalla/funcionalidad nueva**: igual que en el
backend — primero se consulta esta tabla, se agrega a un área existente si
corresponde, y solo se crea un área nueva (acá y en el repo de backend) si
genuinamente no encaja en ninguna.

### Estructura de carpetas sugerida

```
frontend/src/
  areas/
    logistica/
      screens/        pantallas completas del área
      components/     componentes propios de esta área
      api.js           llamadas axios del área, sobre el cliente central
    facturacion/
      ...
  shared/               componentes/utilidades usados por más de un área
  lib/
    httpClient.js       instancia única de axios (ver §4)
```

## 4. Cliente HTTP: siempre axios

Todo consumo de la API del backend usa **axios**, con una única instancia
configurada en `lib/httpClient.js` (o equivalente): `baseURL` desde
`VITE_API_BASE_URL`, `withCredentials: true` para la cookie de sesión, e
interceptor que agrega el header CSRF. No se crean instancias de axios
sueltas por componente, y no se usa `fetch` directo salvo una razón técnica
puntual documentada en el propio commit.

Cada área importa el cliente central y expone sus propias funciones de
llamada (`areas/logistica/api.js`) — no llama a axios directo desde un
componente de pantalla.

## 5. Estructura y estado

- Componentes por pantalla/área de negocio (§3), no un archivo gigante por
  funcionalidad. Si un componente supera unas ~300 líneas, es señal de que
  falta dividir responsabilidades (lógica de datos al `api.js` del área, UI
  a sub-componentes).
- Estado de servidor (datos que vienen de la API) separado de estado de UI
  local — si la complejidad de cachear/revalidar crece, evaluar una
  librería de data-fetching antes de construir una propia a mano.
- La UI oculta u ofusca acciones que el usuario no puede hacer *como ayuda
  visual*, nunca como único control de acceso (principio 3 en §2) — el
  backend ya rechaza la petición aunque el botón esté visible.

## 6. Configuración y variables de entorno

- Todo lo que está en un archivo `VITE_*` **es público**: termina en el
  bundle que se sirve al navegador, cualquiera puede verlo con las
  herramientas de desarrollador. Nunca poner ahí un secreto real (token de
  proveedor, credencial de base de datos, `SECRET_KEY`) — eso vive
  exclusivamente en el repo de backend.
- Lo que sí corresponde en `frontend/.env`: URLs públicas (`VITE_API_BASE_
  URL`) e identificadores de cliente pensados para ser públicos (ej.
  `VITE_GOOGLE_CLIENT_ID`, que por diseño de OAuth es seguro exponer en el
  navegador).
- Una variable nueva se agrega a `.env.example` en el mismo commit que la
  introduce.

## 7. Contrato con el backend

Backend y frontend son repos separados: este repo no puede leer el código
Python del otro para inferir qué endpoints existen. Todo lo que hace falta
saber para consumir la API se toma del contrato documentado por el backend
(`Pamo_app_back/docs/GOVERNANCE.md` §12, o `docs/API-CONTRATO.md` si el
catálogo crece) — método, path, permisos, forma de entrada/salida, códigos
de error.

- **Manejo de errores consistente**: toda llamada axios maneja
  explícitamente 401 (sesión vencida → redirigir a login), 403 (sin permiso
  → pantalla de no autorizado, no un error genérico) y errores 4xx/5xx con
  el mensaje que venga en el body si existe, sin asumir un formato que no
  esté confirmado en el contrato.
- **Endpoints públicos**: algunas pantallas (ej. una cotización compartida
  por link) consumen endpoints que el backend marca como `AllowAny` — esas
  pantallas no se envuelven con el guard de sesión que protege el resto de
  la app, y tampoco asumen que hay un usuario logueado disponible.
- **CORS/cookies entre dominios distintos**: si backend y frontend terminan
  en dominios distintos (no solo subdominios del mismo dominio), la cookie
  de sesión necesita el backend configurado con `SameSite=None; Secure`, y
  acá con `withCredentials: true` en cada request — confirmarlo
  explícitamente en el primer deploy real, no asumir que funciona igual que
  en local.
- **La tabla de áreas (§3)** es la misma en los dos repos — si el backend
  agrega un área nueva, se replica acá.

## 8. Lint

- `oxlint` ya configurado (`npm run lint`) — correrlo antes de cerrar
  cualquier tarea, no acumular warnings nuevos.

## 9. Flujo de cambios (Git / PR)

> **La IA no está autorizada a hacer cambios directamente en `main` ni en la
> rama de producción, bajo ninguna circunstancia.** Todo cambio generado por
> IA (o por un humano) se hace en una rama propia y se sube como Pull
> Request — nunca `git push` directo a `main`/producción, nunca un merge sin
> abrir PR. La aprobación de ese PR la da siempre un humano; la IA puede
> proponer el cambio, describirlo, incluso auto-revisar su propio diff, pero
> no puede ser quien lo apruebe ni quien lo mergea.
>
> Esto no es solo una convención de este documento: la rama de producción
> está protegida en GitHub (branch protection / rulesets — restricción de
> quién puede hacer push/merge) para que ni con permisos de escritura se
> pueda mergear directo. La única vía de entrada a producción es un PR
> aprobado por una persona habilitada.

1. Confirmar rama, working tree limpio y que no hay trabajo concurrente sin
   commitear antes de empezar.
2. Trabajar fuera de `main`; commits pequeños y reversibles.
3. Cerrar la tarea con: desarrollo → `npm run lint` sin warnings nuevos →
   verificar contra el contrato documentado por el backend (§7) que la
   forma de la petición/respuesta coincide con lo implementado ahí.
4. PR con descripción de qué cambia y por qué (no solo qué archivos toca) y
   **aprobación humana obligatoria antes de merge** — sin excepción para
   cambios generados por IA.
5. Ningún secreto en código, commits, logs ni descripciones de PR (recordar
   §6: nada de `VITE_*` con datos sensibles).

## 10. Checklist antes de cerrar cualquier tarea

- [ ] El cambio quedó en una rama propia, nunca commiteado/pusheado directo
      a `main` o producción, y sigue como PR pendiente de aprobación
      humana (§9) — sin excepción por haber sido generado por IA.
- [ ] La funcionalidad quedó en el área correcta (§3) — si se creó un área
      nueva, la tabla quedó actualizada (y replicada en el repo de
      backend).
- [ ] Toda llamada HTTP nueva usa la instancia central de axios (§4), no
      `fetch` ni una instancia suelta.
- [ ] La forma de la petición/respuesta coincide con el contrato
      documentado por el backend (§7) — no se asumió un campo o formato sin
      confirmarlo.
- [ ] `npm run lint` sin warnings nuevos.
- [ ] Ninguna variable en `.env`/`VITE_*` expone un secreto real.
- [ ] Sin componentes, imports o rutas comentadas como código muerto.
- [ ] Cambios aditivos: ninguna pantalla o acción existente quedó oculta o
      degradada sin que la tarea lo pidiera explícitamente.
- [ ] Manejo explícito de 401/403 en cualquier llamada nueva a la API.

## 11. Cómo evoluciona este documento

Esta guía se actualiza cuando se tome una decisión de arquitectura nueva o
cuando un patrón de aquí demuestre no funcionar en la práctica. Al cambiar
una regla, dejar registro de cuál era antes y por qué cambió — no
sobreescribir en silencio. Si el cambio afecta la tabla de áreas o el
contrato de API, replicarlo en `Pamo_app_back/docs/GOVERNANCE.md` en el
mismo ciclo de trabajo.
