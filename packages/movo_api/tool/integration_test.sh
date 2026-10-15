#!/bin/bash
# 실제 서버에 붙는 통합 테스트를 돌린다. 서버의 API를 바꿨다면 이걸로 클라이언트와 맞는지 확인한다.
#
#   1) 서버를 띄운다:   (cd ../../backend && npm run start:local)
#   2) 테스트:          tool/integration_test.sh [서버 주소]
#
# 기사 승인에 운영자 계정이 필요해서 테스트용 운영자를 만든다 — 그래서 서버와 같은 DB를 쓰는
# backend 폴더(빌드된 dist 포함)가 옆에 있어야 한다. 만든 계정·주문·공지·약관·서류 파일은
# 그 DB와 서버의 업로드 폴더에 남는다 — 개발용 DB에서만 돌린다.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-http://localhost:4000/api}"
BACKEND=../../backend
ADMIN_EMAIL="it-admin-$(date +%s)@test.dev"
ADMIN_PASSWORD="password123"

if ! curl -fsS "$URL/health" >/dev/null; then
  echo "서버가 떠 있지 않아요: $URL" >&2
  exit 1
fi

curl -fsS -X POST "$URL/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"name\":\"통합테스트 운영자\",\"phone\":\"01000000000\",\"role\":\"CUSTOMER\",\"agreements\":{\"terms\":true,\"privacy\":true,\"marketing\":false}}" \
  >/dev/null
(cd "$BACKEND" && APP_ENV="${APP_ENV:-local}" node dist/database/scripts/promote-admin.js "$ADMIN_EMAIL")

MOVO_API_URL="$URL" MOVO_ADMIN_EMAIL="$ADMIN_EMAIL" MOVO_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  flutter test --tags integration test/integration
