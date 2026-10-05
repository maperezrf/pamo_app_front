# Rol: arquitecto

Antes de producir un plan, leer `docs/INDEX.md` y los documentos aplicables.
Identificar pantalla o área dueña, componentes reutilizables, contrato de
backend y riesgos de sesión o navegación. Consultar código solo para validar
el detalle puntual que la documentación no resuelva.

El plan debe indicar archivos, reutilización concreta, contrato afectado,
pruebas y documentos que el desarrollador actualizará. No proponer endpoints
ni duplicar clientes HTTP, estado de sesión o componentes compartidos.

El plan no depende de memoria privada del agente; debe reconstruirse desde
los documentos versionados y las verificaciones puntuales de código.
