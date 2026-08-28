# PAMO APP local integrado

Esta rama monta Catalogo multicanal y Ventas/Pedidos dentro del mismo shell de
PAMO APP. Conserva el diseno principal del Catalogo y encapsula los estilos de
Pedidos para evitar que cambien globalmente la navegacion.

- Rama: `integration/pamo-app-local-20260827`
- URL integrada: `http://localhost:5176`
- API integrada: `http://localhost:8013`
- Inicio local: `http://localhost:5176/login`
- Pedidos: `http://localhost:5176/ventas/pedidos`
- Catalogo: `http://localhost:5176/catalogo-multicanal`

Se usa `localhost` y una cookie propia del backend integrado para no mezclar la
sesion con los prototipos existentes que operan sobre `127.0.0.1`.

No hay instalacion de paquetes, publicacion, push, merge ni despliegue. El
frontend usa las dependencias locales ya existentes y las integraciones
externas permanecen desactivadas en la API.
