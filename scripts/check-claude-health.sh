#!/usr/bin/env bash
# Verificação pós-deploy: status das chamadas claude* nos últimos N segundos e erros recentes do gateway.
# Uso (na VPS): bash check-claude-health.sh [segundos=150]
set -u
WINDOW="${1:-150}"
set -a; . /home/sixtysix/app/.env; set +a
echo "agora (UTC): $(date -u +%FT%TZ)"
echo "healthz: $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/healthz)"
SINCE="$(date -u -d "-${WINDOW} seconds" +%Y-%m-%dT%H:%M:%SZ)"
echo "janela desde: $SINCE"
curl -sS -G "$SUPABASE_URL/rest/v1/gateway_usage" \
  -d select=status_code,input_tokens,output_tokens,latency_ms \
  -d 'requested_alias=like.claude*' \
  -d "created_at=gte.$SINCE" -d limit=1000 \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" |
node -e '
let s = ""
process.stdin.on("data", d => (s += d)).on("end", () => {
  const rows = JSON.parse(s)
  const byStatus = {}
  let empty = 0
  for (const r of rows) {
    byStatus[r.status_code] = (byStatus[r.status_code] || 0) + 1
    if (r.status_code === 200 && !r.input_tokens && !r.output_tokens) empty++
  }
  const lat = rows.map(r => r.latency_ms).sort((a, b) => a - b)
  console.log("chamadas claude*:", rows.length)
  console.log("por status:", JSON.stringify(byStatus))
  console.log("200 vazios (0 in / 0 out):", empty)
  if (lat.length) console.log("latência ms  mediana:", lat[Math.floor(lat.length / 2)], " máx:", lat[lat.length - 1])
})'
echo "--- erros do gateway na janela (horário local da VPS) ---"
CUTOFF="$(date -d "-${WINDOW} seconds" +%Y-%m-%dT%H:%M:%S)"
for f in /home/sixtysix/.pm2/logs/sixtysix-a-error.log /home/sixtysix/.pm2/logs/sixtysix-b-error.log; do
  tail -n 400 "$f" | awk -v c="$CUTOFF" 'substr($0,1,19) >= c' | cut -c1-280
done | tail -n 20