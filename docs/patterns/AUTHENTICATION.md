# Patrón: autenticación y sesión

El login usa `GoogleLogin` y envía la credencial al backend mediante
`api.loginWithGoogle()`. El backend valida la identidad, el correo permitido
y crea la sesión HTTP. El frontend nunca interpreta ni persiste tokens de
Google.

Al iniciar la aplicación, `App.jsx` pide CSRF y luego consulta `api.me()`.
Mientras se comprueba la sesión, el estado es `null`; una sesión válida carga
usuario y menú. Logout limpia el estado local después de llamar al backend y
redirige a `/login`.

Las rutas privadas se anidan bajo `AppShell`. No convertir un fallo de
autorización en una pantalla que parezca autenticada; dirigir el caso al
estado correspondiente y conservar mensajes accionables para la persona.
