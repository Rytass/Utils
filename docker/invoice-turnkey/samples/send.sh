#!/bin/bash
# 驗證區送測工具：以範本產生訊息 →（選用）XSD 驗證 → 投遞到 Turnkey UpCast → 等平台 ProcessResult → 解出結果
#   用法：KEY=VALUE ... ./send.sh <範本檔> <輸出檔名（不含 .xml）>
#   例：NO=ZZ12345601 DATE=20260101 TIME=10:00:00 RAND=1234 ./send.sh F0401-B2B.xml ZZ12345601
#   範本中的 __KEY__ 會被同名環境變數取代；仍殘留 __ 佔位符時中止。
set -euo pipefail
cd "$(dirname "$0")"
tpl=$1; name=$2
COMPOSE=(docker compose -f "${COMPOSE_FILE:-../compose.yaml}")
type=$(grep -oE 'eInvoiceMessage:[A-Z][0-9]{4}' "$tpl" | head -1 | cut -d: -f2)
case $type in
  F0401|F0501|F0701|G0401|G0501|G0701) cat=B2SSTORAGE ;;
  E0401|E0402) cat=B2PMESSAGE ;;   # E0401/E0402 folder: create it once via the text-mode menu (see README, "Invoice number message folder")
  *) cat=B2BEXCHANGE ;;
esac
# XSD 驗證為選用：設定 XSD_DIR 指向自備的 MIG 4.1 XSD 目錄（含 <type>.xsd）才會驗證
xsd=${XSD_DIR:+$XSD_DIR/$type.xsd}
out=$(mktemp -d)/$name.xml
content=$(cat "$tpl")
while read -r ph; do
  key=${ph#__}; key=${key%__}
  val=${!key:-}
  [[ -z $val ]] && { echo "缺少變數 $key" >&2; exit 2; }
  content=${content//$ph/$val}
done < <(grep -oE '__[A-Z0-9_]+__' "$tpl" | sort -u)
printf '%s\n' "$content" > "$out"
if [[ -n $xsd ]]; then xmllint --noout --schema "$xsd" "$out"; fi
[[ -n ${WAIT_ONLY:-} ]] || "${COMPOSE[@]}" cp "$out" "turnkey:/data/UpCast/$cat/$type/SRC/$name.xml" >/dev/null 2>&1
echo "[$(date +%T)] 已投遞 $cat/$type/$name.xml"
uuid=""
for _ in $(seq 1 60); do
  uuid=$("${COMPOSE[@]}" exec -T turnkey sh -c "grep -ah 'sftpPutFile' /data/log/turnkey | grep '/$name.xml_' | tail -1 | grep -oE 'serverFilename=[^ ]+' | cut -d= -f2" || true)
  [[ -n $uuid ]] && break
  err=$("${COMPOSE[@]}" exec -T turnkey sh -c "find /data/UpCast/$cat/$type/ERR /data/Pack/$cat/ERR /data/SendFile/$cat/ERR -name '$name.xml*' 2>/dev/null | head -1" || true)
  [[ -n $err ]] && { echo "Turnkey 本機處理失敗：$err"; "${COMPOSE[@]}" exec -T turnkey sh -c "grep -ah -B3 'moveSourceToError.*/$name.xml_' /data/log/turnkey | grep -E 'ERROR' | tail -3"; exit 1; }
  sleep 5
done
[[ -z $uuid ]] && { echo "逾時：Turnkey 未送出"; exit 1; }
echo "[$(date +%T)] 已上傳 ${uuid}，等待平台回覆"
for _ in $(seq 1 90); do
  f=$("${COMPOSE[@]}" exec -T turnkey sh -c "find /data/ReceiveFile -name '$uuid*.ProcessResult' | head -1" || true)
  if [[ -n $f ]]; then
    "${COMPOSE[@]}" exec -T turnkey cat "$f" | base64 -d | openssl cms -verify -noverify -inform DER 2>/dev/null \
      | grep -E '<(Code|Description|Parameter[0-9]|InvoiceNumber|AllowanceNumber|ReferenceNumber)>' | sed 's/^ *//'
    echo "[$(date +%T)] 回覆檔 $f"
    exit 0
  fi
  # SFTP 上傳後 callWebApi 可能被平台直接拒絕（例：E0145 收方未設定接收方式），此時不會有 ProcessResult
  err=$("${COMPOSE[@]}" exec -T turnkey sh -c "find /data/SendFile/$cat/ERR -name '$name.xml_*' | head -1" || true)
  [[ -n $err ]] && { echo "平台拒收（callWebApi）：$err"; "${COMPOSE[@]}" exec -T turnkey sh -c "grep -ah -B3 'moveSourceToError.*/$name.xml_' /data/log/turnkey | grep -E 'ERROR' | tail -3"; exit 1; }
  sleep 10
done
echo "逾時：15 分鐘內未收到 ProcessResult"; exit 1
