# Technical debt

Known compromises carried intentionally, with the reason and the intended fix.

---

## PyVis debt-optimization graph (Debt Optimization page)

**What it does now.** `GET /api/get_debts_optimization` returns two HTML documents
(`html.html1` / `html.html2`) produced by the Python **PyVis** library from
`back-end/debt_figures/*.html`. `front-end/src/pages/DebtsPage.js` renders the
selected one inside an `<iframe srcDoc=… sandbox="allow-scripts">`.

**The debt:**

1. **It executes generated HTML + JavaScript.** The PyVis export contains an
   inline `<script>` that builds the network. It is generated server-side from a
   fixed set of operator codes and numeric debt amounts (no user input), and it
   runs inside a sandboxed iframe, so the blast radius is contained — but it is
   still "run a blob of generated script", not a data-driven render.
2. **It loads third-party scripts from CDNs at runtime** — `vis-network` from
   cdnjs and `bootstrap` from jsDelivr. If a CDN is unavailable the graph does
   not render (the settlement **table** below it is unaffected and remains the
   authoritative artefact). `DebtsPage.cleanGraphHtml()` already strips the
   export's dead local references (`lib/bindings/utils.js`, a local `vis.js`, a
   mis-pathed stylesheet) and fixes one vis-network option key.
3. **The iframe is `sandbox="allow-scripts"` only** (no `allow-same-origin`), so
   the framed document cannot reach the parent, read its `localStorage`
   (the demo token) or navigate it. Loosening the sandbox for convenience would
   be a regression.

**Why it is kept for now.** The interactive graph was explicitly requested for
its exploratory value, and the current form is contained and honest. Replacing it
is a deliberate follow-up, not a hotfix.

**Intended fix.** Have the API return the graph as **structured data**
(`{nodes, edges}` JSON — the settlement CSV already carries the same
information), and render it client-side with a charting/graph component that is
already in the bundle or vendored locally (no runtime CDN, no generated script,
no iframe). Keep the before/after toggle and the drag/zoom interaction.

---

## Seeded credentials in `back-end/hashPassword.js`

`back-end/hashPassword.js` is a one-off utility that lists the seeded accounts in
**plaintext** to (re)generate their bcrypt hashes for `db/init/02-data.sql`. The
accounts are fictional and the database is a local educational sample, but a
plaintext credential list in the tree is a smell.

Also note: the seeded admin password is present in already-pushed commit
`133c48b` (`docs/RUNNING.md` of that revision) and in backend test fixtures
(`back-end/testing/**`). The current `docs/RUNNING.md` no longer prints it.

**Intended fix.** Move the seed-account definitions to a single non-committed
source (or `.env`-driven), regenerate the seed with fresh fictional passwords,
and delete `hashPassword.js` in favour of a documented script that reads that
source. Decide separately whether to rotate the seeded admin password given the
pushed history.
