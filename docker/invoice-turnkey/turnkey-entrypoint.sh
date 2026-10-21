#!/bin/bash
# Turnkey 容器進入點
#   start（預設）：背景排程（run_start.sh），收到 SIGTERM/SIGINT 時改呼叫 run_stop.sh 讓排程優雅結束
#   cmd          ：文字模式設定介面（run_cmd.sh），需 docker run -it / docker compose exec
#   stop         ：停止同一容器內的背景排程
#   其他         ：直接執行
set -euo pipefail

cd "${TURNKEY_HOME}"

DATA_DIR=${TURNKEY_DATA:-/data}
CONF_DIR="${DATA_DIR}/config"
CONF_FILE="${CONF_DIR}/einvUserConfig.xml"

mkdir -p "${CONF_DIR}" "${DATA_DIR}/log"

# 首次啟動：以安裝包預設值建立設定檔，並把工作目錄與 log 指到 volume
if [[ ! -f "${CONF_FILE}" ]]; then
    sed -e "s#<def-path>[^<]*</def-path>#<def-path>${DATA_DIR}</def-path>#" \
        -e "s#<file-log>[^<]*</file-log>#<file-log>${DATA_DIR}/log/turnkey</file-log>#" \
        "${TURNKEY_HOME}/einvUserConfig.dist.xml" > "${CONF_FILE}"
    echo "[entrypoint] 已建立預設設定檔 ${CONF_FILE}"
fi
ln -sfn "${CONF_FILE}" "${TURNKEY_HOME}/einvUserConfig.xml"

# 容器內不採用程式自動升級；升級方式為換新版安裝包後重建 image
if [[ -e "${TURNKEY_HOME}/EINVUPGRADE" ]]; then
    echo "[entrypoint] 偵測到 EINVUPGRADE，容器內不執行自動升級，已移除（請改以新版安裝包重建 image）"
    rm -rf "${TURNKEY_HOME}/EINVUPGRADE"
fi

case "${1:-start}" in
    start)
        # 尚未完成資料庫設定時排程會立即結束；改為待命，讓使用者能 exec 進來設定
        if ! grep -q '<db-config-ok>true</db-config-ok>' "${CONF_FILE}"; then
            echo "[entrypoint] 尚未完成資料庫設定，排程未啟動。請執行："
            echo "[entrypoint]   docker compose exec turnkey turnkey-entrypoint cmd"
            echo "[entrypoint] 設定完成後重啟此容器即會啟動排程"
            trap 'exit 0' TERM INT
            sleep infinity &
            wait $!
            exit 0
        fi
        ./run_start.sh &
        child=$!
        stopping=false
        stop_turnkey() {
            stopping=true
            echo "[entrypoint] 收到停止訊號，執行 run_stop.sh"
            ./run_stop.sh || true
        }
        trap stop_turnkey TERM INT
        rc=0
        wait "${child}" || rc=$?
        if [[ "${stopping}" == true ]]; then
            # trap 觸發後 wait 會提前返回，需再等一次讓排程真正結束
            wait "${child}" 2>/dev/null || true
            exit 0
        fi
        # 非主動停止卻結束 → 視為異常，以非 0 退出讓 restart policy 重啟
        echo "[entrypoint] 排程程序非預期結束（exit ${rc}）"
        exit $(( rc == 0 ? 1 : rc ))
        ;;
    cmd)
        exec ./run_cmd.sh
        ;;
    stop)
        exec ./run_stop.sh
        ;;
    *)
        exec "$@"
        ;;
esac
