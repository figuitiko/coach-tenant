# Landing pública por workspace para coaches

## Resumen

Crear una landing promocional mobile-first por workspace en `/c/[workspaceSlug]`.

El coach podrá editar contenido estructurado, previsualizarlo en privado y publicarlo explícitamente. V1 incluirá un único tema `editorial`, con una arquitectura preparada para agregar tres temas seleccionables posteriormente sin migrar el contenido.

## Cambios principales

### Publicación y contenido

- Crear el módulo aislado `marketing` siguiendo la arquitectura modular existente.
- Incorporar secciones fijas y opcionales: hero, propuesta de valor, servicios, metodología, resultados, sobre el coach, FAQ y CTA.
- Implementar revisiones inmutables: editar el borrador nunca modifica lo publicado hasta una nueva publicación.
- Agregar estados operativos de borrador, preview privado, publicación y despublicación.
- Permitir logo y retrato del coach mediante almacenamiento privado y proxy público autorizado.
- Generar metadata SEO, canonical URL, Open Graph y sitemap solamente para landings publicadas.

### Resultados y consentimiento

- Crear tarjetas congeladas de texto y métricas; no incluir fotos de alumnos en v1.
- Usar atribución anónima por defecto. Un nombre o alias solo podrá mostrarse si forma parte de la versión aprobada.
- Vincular el consentimiento al contenido y fingerprint exactos.
- Editar una tarjeta pública retira inmediatamente su versión anterior.
- La nueva versión requiere aprobación del alumno y una nueva publicación explícita del coach.
- Una tarjeta pendiente, revocada o reemplazada bloquea atómicamente la publicación; la landing pública anterior permanece intacta.
- La lectura pública filtra defensivamente cualquier tarjeta revocada o reemplazada.
- Nunca consultar públicamente mediciones, entrenamientos, reviews, fotos privadas ni otras tablas del módulo de progreso.

### Interfaces y conversión

- Coach: `/w/[workspaceSlug]/landing` para editar, previsualizar, publicar y consultar métricas agregadas.
- Alumno: superficie autenticada para revisar, aprobar y revocar la versión exacta de su resultado.
- Público: `/c/[workspaceSlug]`, disponible solamente cuando exista una revisión publicada.
- WhatsApp será el CTA principal mediante un redirect interno y un mensaje prellenado validado.
- Registrar vistas y clics como contadores agregados diarios, sin IP, cookies, teléfono, mensaje ni PII del visitante.
- Exponer únicamente un `PublicCoachLandingDto` allowlisted y neutral al tema.
- Mantener un registro de renderers con solo `editorial` habilitado; claves desconocidas fallan cerradas.

## Implementación por fases

1. Agregar modelos Prisma, migración aditiva, relaciones, fixtures y limpieza segura.
2. Implementar contratos de dominio, validaciones, fingerprints y DTOs.
3. Crear revisiones, repositorios tenant-safe, idempotencia y auditoría transaccional.
4. Implementar versiones de resultados, aprobación, reemplazo y revocación.
5. Implementar publicación atómica y proyección pública independiente.
6. Agregar carga y proxy seguro de logo/retrato.
7. Construir editor, preview, navegación y estados de UI del coach.
8. Construir experiencia de aprobación/revocación del alumno.
9. Crear ruta pública, renderer editorial, SEO, sitemap, WhatsApp y métricas.
10. Probar aislamiento, concurrencia, rollback y proyección pública en PostgreSQL.
11. Cubrir journeys completos desktop/mobile con Playwright.
12. Ejecutar verificación final y rollout migración → aplicación; nunca ejecutar build.

## Plan de pruebas

- Strict TDD en cada fase: RED → GREEN → refactorización.
- Probar revisiones inmutables, validación de publicación, idempotencia y conflictos optimistas.
- Probar que Coach A no puede acceder ni mutar la landing, resultados o medios de Coach B.
- Probar aprobación por el alumno correcto, fingerprint exacto, revocación terminal y rechazo de approvals obsoletos.
- Probar que una tarjeta pendiente bloquea la publicación sin alterar la landing pública vigente.
- Probar que reemplazo y revocación eliminan la tarjeta en la siguiente petición pública.
- Probar que el DTO público no contiene IDs internos, datos privados, claves S3 ni objetos Decimal.
- Probar metadata, sitemap, 404/noindex, accesibilidad, navegación por teclado y viewport de 320 px.
- Verificación final: unitarias, PostgreSQL integration, Playwright público/autenticado, Prisma validate, lint y typecheck. No production build.

## Supuestos y límites

- V1 tendrá un único tema y no mostrará selector.
- Los workspaces existentes seguirán privados hasta una publicación explícita.
- No habrá CMS de bloques, fotos de alumnos, CRM/formulario interno, reservas, pagos, dominios personalizados ni páginas individuales de resultados.
- La revocación controla solicitudes futuras; no puede retirar contenido que un visitante ya descargó o copió.
- El éxito piloto será que el coach configure y publique sin asistencia, comparta la URL y reciba consultas atribuibles por WhatsApp antes de invertir en más temas.

## Artefactos SDD

- `sdd/workspace-coach-landing-page/explore`
- `sdd/workspace-coach-landing-page/proposal`
- `sdd/workspace-coach-landing-page/spec`
- `sdd/workspace-coach-landing-page/design`
- `sdd/workspace-coach-landing-page/tasks`

## Key Learnings

1. Una landing pública debe consumir una proyección explícita, nunca los datos privados del alumno.
2. Consentimiento exacto, publicación y acceso privado son tres permisos completamente diferentes.
3. Desacoplar contenido y renderer permite agregar temas sin convertir v1 en un CMS.
