# PAMO APP local integrado

Esta rama monta Catalogo multicanal y Ventas/Pedidos dentro del mismo shell de
PAMO APP. Conserva el diseno principal del Catalogo y encapsula los estilos de
Pedidos para evitar que cambien globalmente la navegacion.

- Rama: `integration/pamo-app-local-20260827`
- URL integrada: `http://127.0.0.1:5176`
- API integrada: `http://127.0.0.1:8013`
- Inicio local: `http://127.0.0.1:5176/login`
- Pedidos: `http://127.0.0.1:5176/ventas/pedidos`
- Catalogo: `http://127.0.0.1:5176/catalogo-multicanal`

No hay instalacion de paquetes, publicacion, push, merge ni despliegue. El
frontend usa las dependencias locales ya existentes y las integraciones
externas permanecen desactivadas en la API.

