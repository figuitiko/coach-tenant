# Architecture and security

Tenand is a server-first modular monolith. App Router pages compose application services; presentation components receive serializable DTOs and never import Prisma. Identity, tenancy, training and progress modules keep business rules separate from PostgreSQL/S3 adapters.

Every authenticated operation resolves a global user plus a workspace membership and scopes reads/writes by `workspaceId`; role checks distinguish coach authoring/review from student logging/check-ins. Repository mutations recheck ownership inside transactions, so a URL or identifier from another tenant is not authority. Private progress photos store only object metadata and are delivered through an authenticated tenant-scoped route—never a public URL.

Passwords are managed by Better Auth, invitations are expiring/single-use, sensitive values stay server-side, and browser responses receive CSP, frame, MIME-sniffing, referrer and permissions defaults. `/api/health` leaks no connection strings or exception messages. Audit/product events support pilot diagnosis without introducing nutrition, gallery publishing, billing, chat, or team-management scope.
# Authorization roles

`User.platformRole` is platform scope (`USER` or `SUPER_ADMIN`) and is deliberately separate from tenant-scoped `Membership.role` (`COACH` or `STUDENT`). A super admin receives an explicit `SUPER_ADMIN` workspace access context without synthetic membership rows. Ordinary users can only list and enter workspaces returned by their memberships. Every mutation continues to carry the authenticated user ID as the actor and the selected workspace ID as the tenant boundary; UI labels and hidden links are never treated as authorization.
