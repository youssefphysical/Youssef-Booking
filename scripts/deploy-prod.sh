#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: VERCEL_TOKEN env var is not set." >&2
  exit 1
fi

if [[ ! -f .vercel/project.json ]]; then
  mkdir -p .vercel
  cat > .vercel/project.json <<'EOF'
{"projectId":"prj_6Lm90uZsYXXd8etLmmJ36d95WoB0","orgId":"team_vglbcDgYDiQneTdi156BL5bF"}
EOF
fi

echo "▲ Deploying local workspace to Vercel production ($(date -u +%FT%TZ))"
npx --yes vercel@latest deploy --prod \
  --token="$VERCEL_TOKEN" \
  --yes \
  --archive=tgz \
  "$@"
