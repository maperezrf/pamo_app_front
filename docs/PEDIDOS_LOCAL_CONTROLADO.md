# Pedidos local controlado - interfaz

## Identidad y aislamiento

- Rama: `feature/pedidos-local-controlado-20260827`.
- Base: `main` en `85c76e36a71c6aa9615151623265175176d1643d`.
- Punto previo recuperable: `checkpoint/pre-pedidos-local-20260827-front`.
- La interfaz respeta la identidad oficial PAMO: verde principal `#1f6f4a`,
  verde oscuro `#16231b`, verde pálido `#e6f2eb`, tipografía Geist y dorado
  reservado al logotipo.
- No reutiliza como diseño canónico el laboratorio Carbon ni cruza código con
  Remisiones, Facturación o Multicanal.
- No se ha hecho push, merge ni despliegue.

## Inicio local

Variables locales:

```text
VITE_API_URL=http://127.0.0.1:8012/api
VITE_LOCAL_DEMO_AUTH=true
```

Después:

```text
npm run dev -- --host 127.0.0.1 --port 5175
```

Abrir `http://127.0.0.1:5175/`. El puerto 5175 evita interferir con los
entornos que ya usan 5173 y 5174.

## Continuidad operativa

- La última lectura correcta queda como contingencia local, separada por
  usuario y con vencimiento de 15 minutos.
- Un fallo de API muestra el estado y permite reintentar; no presenta una tabla
  vacía como si no existieran pedidos.
- En la tabla, el ID conserva el enlace al canal de origen y el resto de la fila
  abre el detalle operativo.
- La vista compacta móvil oculta el menú lateral y conserva acceso mediante el
  botón superior.

## Límites actuales

Esta interfaz trabaja con el backend y datos sanitizados locales. No prueba por
sí sola sincronización real de Shopify, Envía, Mercado Libre, Falabella o
Sodimac. La conexión de lecturas reales es la siguiente fase; cualquier
escritura externa o promoción a Beta/Producción requiere otra autorización.

