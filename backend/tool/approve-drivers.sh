#!/bin/bash
# 심사 대기 중인 라이더를 모두 승인한다. 앱만 돌려 볼 때 개발·테스트에서 쓴다.
#
#   tool/approve-drivers.sh <운영자 이메일> <비밀번호> [서버 주소]
#
# 운영자 계정은 가입한 뒤 `npm run admin:promote -- <이메일>`로 만든다.
set -euo pipefail

EMAIL="${1:?운영자 이메일을 적어 주세요}"
PASSWORD="${2:?비밀번호를 적어 주세요}"
URL="${3:-http://localhost:4000/api}"

if ! curl -fsS "$URL/health" >/dev/null; then
  echo "서버가 떠 있지 않아요: $URL" >&2
  exit 1
fi

LOGIN=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" python3 -c \
  'import json, os; print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PASSWORD"]}))')
if ! SESSION=$(curl -fsS -X POST "$URL/auth/login" -H 'Content-Type: application/json' -d "$LOGIN" 2>/dev/null); then
  echo "로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요." >&2
  exit 1
fi
TOKEN=$(printf '%s' "$SESSION" | python3 -c 'import json, sys; print(json.load(sys.stdin)["accessToken"])')

if ! DRIVERS=$(curl -fsS "$URL/admin/drivers?status=PENDING&size=100" -H "Authorization: Bearer $TOKEN" 2>/dev/null); then
  echo "라이더 목록을 받지 못했어요. 운영자 계정인지 확인해 주세요: npm run admin:promote -- $EMAIL" >&2
  exit 1
fi
PENDING=$(printf '%s' "$DRIVERS" | python3 -c 'import json, sys; print("\n".join(d["id"] for d in json.load(sys.stdin)["items"]))')

if [ -z "$PENDING" ]; then
  echo "심사 대기 중인 라이더가 없어요."
  exit 0
fi

for ID in $PENDING; do
  curl -fsS -X PATCH "$URL/admin/drivers/$ID/approve" -H "Authorization: Bearer $TOKEN" >/dev/null
  echo "승인: $ID"
done
