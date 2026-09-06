# Authorization model

Enforced on the **backend** (`middlewares/authMiddleware.js` + per-route wiring).
Frontend hiding is a convenience, never a security control. Covered by
`back-end/testing/authorization.test.js` (46 cases) and the integration smoke test.

## Roles

| Role | Source | Meaning |
|---|---|---|
| *(none)* | no / invalid token | anonymous visitor |
| `demo` | `POST /api/auth/demo-login` (seeded identity `demo@toll-analysis.example`) | fictional **platform-wide, read-only observer** for the public portfolio demo. Short-lived token (60–120 min). |
| company roles: `aodos`, `gefyra`, `egnatia`, `kentrikiodos`, `moreas`, `neaodos`, `olympiaodos` | `POST /api/login` | one seeded account per toll operator |
| `admin` | `POST /api/login` (`admin@yme.gov.gr`) | full access |

Role comes **only** from the verified JWT (`user_role` claim). A token claiming an
unknown role is denied everywhere except public routes. `demo-login` takes no
input, so a caller cannot request a role.

## Middleware

- `authenticateToken` — valid JWT required, else **401**.
- `authorizeRole([...])` — `req.user.user_role` must be in the list, else **403**
  (`Access Denied - Insufficient Permissions`).
  - `ANALYTICS_ROLES = ['admin', 'demo', ...companyRoles]`
  - `ADMIN_ROLES = ['admin']`
- `blockDestructiveOps` — when `DISABLE_DESTRUCTIVE_OPS=true`, returns
  **403 `{"error":{"code":"DEMO_MODE_RESTRICTION"}}`** *before* the handler runs.
  (Not 503 — the operation is deliberately forbidden, not temporarily down.)

## Matrix

| Capability | Endpoint(s) | Visitor | Demo | Company | Admin |
|---|---|:--:|:--:|:--:|:--:|
| Health | `GET /healthz` | ✅ | ✅ | ✅ | ✅ |
| Admin health | `GET /api/admin/healthcheck` | 401 | 403 | 403 | ✅ (200 / 503) |
| Landing + static | `/`, `/static/**` | ✅ | ✅ | ✅ | ✅ |
| Public map data | `GET /api/tolls` | ✅ | ✅ | ✅ | ✅ |
| Read analytics | `GET /api/{passAnalysis,chargesBy,passesCost,tollStationPasses}/…` | 401 | ✅ | ✅ | ✅ |
| Read forecasts | `GET /api/forecast/…`, `GET /api/peak_hour/…` | 401 | ✅ | ✅ | ✅ |
| Debt-optimization figures | `GET /api/get_debts_optimization` | 401 | ✅ | ✅ | ✅ |
| Model training | `POST /api/training` | 401 | 403 | 403 | 403¹ / ✅² |
| Upload / import passages | `POST /api/upload_passages`, `PUT /api/passing_toll`, `POST /api/admin/addpasses` | 401 | 403 | 403 | 403¹ / ✅² |
| Reset DB / stations / passes | `POST /api/admin/reset{passes,stations}` | 401 | 403 | 403 | 403¹ / ✅² |
| Mutate / cancel debts | `PATCH /api/cancel_debts` | 401 | 403 | 403 | 403¹ / ✅² |
| User administration | `GET /api/admin/users`, `POST /api/admin/usermod`, `POST /api/admin/setrole`, `DELETE /api/admin/userdelete/:u` | 401 | 403 | 403 | 403¹ / ✅² |

¹ when `DISABLE_DESTRUCTIVE_OPS=true` (the bundled compose stack) → 403 `DEMO_MODE_RESTRICTION`
² when `DISABLE_DESTRUCTIVE_OPS=false`

**Key guarantee:** the `demo` role is **never** in `ADMIN_ROLES`, so demo users
get 403 on every destructive endpoint *regardless of the flag*. The flag only
gates `admin`.

## Company-role data scope (current behaviour)

The analytics endpoints take the operator id **as a URL parameter**
(`/api/chargesBy/:tollOpID/…`) and the controllers query by that parameter.
They do **not** cross-check it against the caller's own company role. So a
company user can currently request another operator's figures.

This dataset is a shared educational sample and every operator's aggregate
figures are effectively public information here, so this is **documented, not a
data leak** — but it is not correct company isolation. See
`docs/MILESTONE-B-REPORT.md` §9 for the finding and the recommended fix
(reject when `:tollOpID` ≠ the caller's mapped company, for non-admin/non-demo).
Milestone B adds a regression test that pins today's behaviour so a future
change is deliberate.
