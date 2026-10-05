# Instrucciones para agentes — Frontend Pamo

Antes de planear, leer código o modificar archivos:

1. Leer [`docs/INDEX.md`](docs/INDEX.md) completo.
2. Leer arquitectura, app, patrón y contrato aplicables.
3. Buscar una capacidad reutilizable documentada.

El código solo se consulta después para validar el estado real o resolver una
duda concreta. Al cerrar, actualizar la documentación si el cambio modifica
una capacidad reutilizable, contrato, regla relevante o integración.

`docs/` es la fuente durable y compartida. No depender de memoria privada del
agente, historial de chat o archivos externos al repositorio. Un dato útil de
esas fuentes se verifica y se incorpora al documento versionado aplicable.

No incluir secretos en variables `VITE_*`: son públicas en el navegador.
