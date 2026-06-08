# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ShadowBroker is a self-hosted, decentralized OSINT situational-awareness platform: a real-time geospatial intelligence dashboard that aggregates 60+ live public data feeds (aircraft ADS-B, ships AIS, satellites, CCTV, GPS jamming, SAR ground-change, police scanners, mesh radio, GDELT conflict events, etc.) onto one MapLibre map. It also ships an experimental decentralized mesh ("InfoNet" testnet + "Wormhole" DMs) and an HMAC-signed agent command channel ("OpenClaw").

It is a polyglot monorepo with five cooperating components:

| Component | Path | Stack | Role |
|-----------|------|-------|------|
| Backend | `backend/` | Python 3.10+, FastAPI, `uv` | API, all data fetchers, mesh node, auth |
| Frontend | `frontend/` | Next.js 16, React 19, MapLibre GL, Vitest | Dashboard HUD + server-side `/api/*` proxy |
| Privacy core | `privacy-core/` | Rust → WASM + `.so` | MLS group/DM crypto primitives (shared by both) |
| Desktop shell | `desktop-shell/` | TypeScript, Tauri | Native packaging, privileged control routing |
| OpenClaw skill | `openclaw-skills/shadowbroker/` | Python | Agent-side client for the command channel |

`pyproject.toml` at the root defines a `uv` workspace whose only member is `backend/`. Versions are kept in lockstep at `0.9.81` across `pyproject.toml` files and `package.json` files.

## Commands

### Running locally (dev)
```bash
cd frontend && npm install && npm run dev   # runs BOTH frontend (:3000) and backend (:8000)
```
`npm run dev` → `scripts/dev-all.cjs`, which spawns Next.js plus `start-backend.js`. `start-backend.js` auto-creates/locates a Python venv under `backend/venv` and launches uvicorn — you do **not** need to start the backend separately. Use `npm run dev:frontend` / `npm run dev:backend` to run one side only.

### Running via Docker (production-like)
```bash
docker compose up -d          # pulls prebuilt GHCR images; dashboard on :3000, API on :8000
make up-local                 # 127.0.0.1 binding; make up-lan binds 0.0.0.0 with CORS for LAN
```
The compose file does **not** build from source — it pulls `ghcr.io/bigbodycobain/shadowbroker-{backend,frontend}:latest`. A `docker-compose.yml` containing `build:` directives means a stale pre-migration clone.

### Backend: lint, format, test
```bash
cd backend
uv sync --frozen --group dev                 # install deps (use --extra road-corridor for the satellite truck-detection extras)
uv run ruff check .
uv run black --check .                        # NOTE: black is force-excluded (see pyproject) — it checks nothing by design
uv run pytest                                 # pytest.ini sets testpaths=tests; run from backend/
uv run pytest tests/test_schemas.py           # single file
uv run pytest tests/test_schemas.py -k some_name   # single test
```

### Frontend: lint, format, test
```bash
cd frontend
npm run lint                                  # eslint
npm run format:check                          # prettier --check
npx vitest run                                # full suite (CONTRIBUTING's documented command)
npx vitest run src/__tests__/mesh/foo.test.tsx     # single file
npx vitest run -t "name of test"              # single test by name
npm run build && npm run bundle:report        # production build + bundle-size gate
```
The `npm run test:*` scripts inject `NODE_OPTIONS=--require ./scripts/vite-no-net-use.cjs` (a Windows `net use` shim) and are Windows-flavored (`set NODE_OPTIONS=...`); on Linux/macOS prefer `npx vitest run` directly. `@/` resolves to `frontend/src/`.

### Secret scan (CI-blocking, also a pre-commit hook)
```bash
bash backend/scripts/scan-secrets.sh --all    # CI runs this; --staged is the pre-commit variant
pre-commit run --all-files                     # ruff/black/prettier/secret-scan/yaml+json checks
```

### CI gates (`.github/workflows/ci.yml`)
- **Frontend job:** `npm ci` → `lint` → `format:check` → `vitest run` → `build` → `bundle:report`. All must pass.
- **Backend job:** secret scan → `ruff check` → `black --check` → an import smoke test → a **subset** of pytest (`tests/mesh/test_mesh_*`, `test_release_helper.py`). Full pytest is run locally/by contributors, not in this CI job.

## Architecture notes

### Backend is a FastAPI monolith + extracted routers/services
- `backend/main.py` is ~11.6k lines: it builds the `FastAPI` app (`app = FastAPI(...)`, ~line 2721), wires a `lifespan` that starts background mesh sync/push/pull worker threads, and `include_router`s ~18 routers (~line 3629).
- `backend/routers/*.py` — thin HTTP surface, grouped by domain (`data`, `cctv`, `radio`, `sigint`, `sar`, `mesh_*`, `wormhole`, `ai_intel`, `infonet`, `admin`, …).
- `backend/services/*.py` — business logic. The data-feed fetchers live in `backend/services/fetchers/` (one module per source: `flights`, `satellites`, `military`, `news`, `sar_*`, etc.) behind `data_fetcher.py` + `feed_ingester.py`. Resilience helpers: `fetchers/retry.py` (`with_retry`), `fetch_health.py`, `limiter.py` (slowapi rate limiting).
- **Public vs authenticated exposure is enforced by `_redact_*` serializers** in `main.py` (e.g. `_redact_public_mesh_status`, `_redact_wormhole_settings`). When adding fields to a mesh/wormhole/oracle response, check whether an unauthenticated caller should see them and route through the matching redactor. Tests like `test_round5_settings_info_disclosure.py` guard this.
- Auth lives in `backend/auth.py` (large, CODEOWNER-gated): admin-key auth, scoped view auth, and HMAC request signing for the OpenClaw agent channel.

### Frontend talks only to its own backend via a server-side proxy
The browser never calls third-party APIs for core feeds. The Next.js server proxies everything through `frontend/src/app/api/[...path]/` (and `api/admin/`) to `BACKEND_URL`. Backend resolution order (`frontend/src/lib/backendEndpoint.ts`, see `frontend/README.md`): `NEXT_PUBLIC_API_URL` (build-time) → SSR `localhost:8000` → client auto-detect from `window.location.hostname:8000`. UI panels are in `frontend/src/components/`, map rendering under `components/map` + `MaplibreViewer/`.

### Mesh / InfoNet / Wormhole is the largest and most security-sensitive subsystem
- Backend: `backend/services/mesh/` (peer sync, hashchain, Merkle/IBF reconciliation, MLS gates & DMs, ratchets, dead drop, secure storage) and `backend/services/infonet/` (chain, gates, governance, markets, reputation, privacy).
- Frontend mirror: `frontend/src/mesh/` — gate envelopes, DM ratchet, web workers (`meshDm.worker.ts`, `meshGate.worker.ts`), and the WASM bridge in `privacyCoreWasm/`.
- Crypto primitives (MLS) are implemented once in Rust `privacy-core/src/lib.rs` and consumed two ways: compiled to **WASM** for the frontend (`frontend/scripts/build-privacy-core-wasm.cjs`, `npm run build:privacy-core-wasm`) and to a **`.so`** loaded by the backend. The build pin is enforced by SHA256 (`PRIVACY_CORE_ALLOWED_SHA256`, set by `backend/docker-entrypoint.sh`; refresh with `scripts/refresh_privacy_core_pin.py`). Mesh design docs and canonical test fixtures live in `docs/mesh/`.
- Peer sync defaults to **private transports only** (Tor `.onion` via Arti SOCKS); clearnet sync is opt-in (`MESH_INFONET_ALLOW_CLEARNET_SYNC`).

### Outbound-data opt-ins (privacy posture — read before touching fetchers)
This is a self-hosted tool: each install's backend egress IP contacts upstreams directly. Many fetchers are **OFF by default** because they phone home to sensitive providers — `PREDICTION_MARKETS_ENABLED`, `FINANCIAL_ENABLED`, `CROWDTHREAT_ENABLED`, `FIMI_ENABLED`, `NUFORC_ENABLED`, and `MESH_MQTT_ENABLED` (see `docker-compose.yml`, `Mesh.md`, `docs/OUTBOUND_DATA.md`). Outbound requests use a **per-install** User-Agent (`backend/services/network_utils.py`, `outbound_user_agent()`), not a shared product token. Don't flip a default-off fetcher to on, broaden a User-Agent, or add a new outbound call without preserving this opt-in model — there is dedicated test coverage (`test_*_opt_in.py`, `test_third_party_fetchers_opt_in.py`) and an audit trail in `docs/OUTBOUND_DATA.md`.

## Conventions specific to this repo

- **Don't reformat the legacy tree.** `black` is intentionally `force-exclude = ".*"` and `ruff` ignores a list of style codes (`E401`, `F401`, `F841`, …) — this is deliberate release-time debt management, not an oversight. Match surrounding style; don't run a whole-file formatter.
- **CODEOWNER-gated paths** (require maintainer review, change carefully): `frontend/src/i18n/`, `backend/auth.py`, `backend/routers/wormhole.py`, `backend/services/mesh/`, `backend/services/fetchers/`, CI/compose/helm infra. See `.github/CODEOWNERS`.
- **i18n must be neutral and 100% client-side static JSON.** Translations in `frontend/src/i18n/` must be technically faithful to the English source (no political reframing) and must not add any network/telemetry. See the "Translation contributions" section of `CONTRIBUTING.md`.
- **Vitest timeouts are bumped to 15s** in `frontend/vitest.config.js` to absorb CI load on heavy React component tests — don't lower them assuming a hang.
- Security issues are **not** filed as public GitHub issues (see `CONTRIBUTING.md`); commit/PR history references audit issue numbers (e.g. `#348–#366`).
