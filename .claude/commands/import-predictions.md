Import a user's predictions from a raw JSON export into the app.

The user will provide some or all of: a JSON file path, an output slug, and a display name. Ask for anything missing before proceeding.

## Steps

### 1. Collect arguments

You need three values:
- `<input-json>` — path to the raw export JSON (e.g. `raw_exports/foo-wc2026-predictions.json`)
- `<output-slug>` — kebab-case filename for the user (e.g. `foo-bar`)
- `<name>` — display name in Hebrew (e.g. `"פו בר"`)

If any are missing, ask the user before continuing.

### 2. Run the precompute script in import mode

```bash
node --experimental-strip-types scripts/precompute-predictions.ts <input-json> <output-slug> "<name>"
```

This creates `src/users/<output-slug>.ts` with predictions and all precomputed data in one step.

### 3. Add the user to the index

Open `src/users/index.ts` and add an import and entry for the new user (follow the existing pattern).

### 4. Report

Confirm which files were written.
