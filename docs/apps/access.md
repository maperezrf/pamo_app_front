# Área: acceso

La pantalla `src/modules/access/pages/LoginPage.jsx` presenta el inicio de
sesión con Google y `UnauthorizedPage.jsx` el rechazo; las dos usan
`AuthLayout` (`src/app/layouts/AuthLayout/`). La ilustración de la derecha
(`AuthHero`) está hecha con el tema y los logos de canales mientras no haya
una imagen corporativa; al tenerla, se reemplaza solo `AuthHero`.
Recibe callbacks de `App.jsx`: una respuesta autorizada entrega el usuario;
un rechazo `403` dirige a la pantalla de no autorizado; otros fallos muestran
un mensaje que permite reintentar.

La autorización real vive en backend. El frontend muestra el resultado y
protege navegación, pero no decide si un correo o grupo tiene permisos.

Los elementos del menú llegan del endpoint de backend y se entregan a
`AppShell`; no hardcodear permisos o módulos solo en el cliente.
