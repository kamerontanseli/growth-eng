Create `/Users/kameron/Desktop/growth_eng/.gitignore` with:

- **Dependencies**: `node_modules/`
- **Build output**: `build/` (bun build), `dist/` (tsc outDir)
- **Logs**: `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`, `*.log`
- **Environment / secrets**: `.env`, `.env.*` (with `!.env.example` kept trackable)
- **Caches**: `.npm/`, `.bun/cache/`, `.DS_Store` (macOS)
- **Editor cruft**: `.vscode/` (except shared settings), `.idea/`, `*.swp`

Standard Node.js gitignore patterns (aligned with github/gitignore's Node template) plus the two build directories specific to this project. Single new file, no other changes.