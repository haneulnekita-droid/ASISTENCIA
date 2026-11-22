# Security Specification — Mi Huella de Bienestar (Firestore)

## 1. Data Invariants
1. **PII Isolation**: `/attendance_records` and `/duplicate_attempts` contain student names and codes. Public unauthenticated clients can NEVER `get`, `list`, `update`, or `delete` them. Only verified facilitators (`isAdmin()`) may read or list them.
2. **Atomic Duplicate Prevention & Immutability**: `/attendance_records/{recordId}` uses a deterministic key (`code_date_sessionHash`) and allows `create` ONLY (`allow update, delete: if false`). Concurrent submissions from different devices with different student codes succeed atomically in parallel; a second submission with the same deterministic key triggers `update` (denied) and is logged to `/duplicate_attempts`.
3. **Strict Schema & No Shadow Fields**: Every `create` and `update` rule validates exact allowed keys via `hasAll` and `hasOnly`, string/list bounds via `.size()`, regex format checks, and `request.time` server timestamp equality.
4. **Admin Bootstrap & Verified Email**: `isAdmin()` requires `request.auth != null && request.auth.token.email_verified == true` matching the provisioned facilitator email or an existing `/admins/{uid}` record.

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated `list` on `/attendance_records` -> `PERMISSION_DENIED`
2. Unauthenticated `get` on `/attendance_records/{id}` -> `PERMISSION_DENIED`
3. Unauthenticated `update` / `setDoc` overwrite on existing `/attendance_records/{id}` -> `PERMISSION_DENIED`
4. Shadow field injection (`isAdmin: true`, `extraField: "hack"`) on `/attendance_records` create -> `PERMISSION_DENIED`
5. Spoofed client timestamp (`createdAt: new Date(0)`) instead of `request.time` -> `PERMISSION_DENIED`
6. Oversized document ID poisoning (`150+` chars or `/` / `$` in `{recordId}`) -> `PERMISSION_DENIED`
7. Oversized string field (`nombres` > 80 chars or `codigo` > 40 chars) -> `PERMISSION_DENIED`
8. Invalid date/time format (`fecha: "22-11-2026"`) -> `PERMISSION_DENIED`
9. Email spoofing (`email == 'haneulnekita@gmail.com'`, `email_verified == false`) -> `PERMISSION_DENIED`
10. Non-admin authenticated user writing `/admins/{uid}` -> `PERMISSION_DENIED`
11. Non-admin user modifying `/config/workshop` -> `PERMISSION_DENIED`
12. Invalid enum value in `/pulse_responses` (`semesterTrend: "hacked"`) -> `PERMISSION_DENIED`
