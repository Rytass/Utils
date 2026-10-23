#!/bin/bash
# Turnkey 容器進入點
#   start（預設）：有自動設定的輸入時先執行 configure，再啟動背景排程（run_start.sh）；
#                 收到 SIGTERM/SIGINT 時呼叫 run_stop.sh 讓排程優雅結束，收到 SIGHUP 時重啟排程
#   configure    ：依設定檔或環境變數收斂 Turnkey 設定（參數見 turnkey_setup.py）；有變更時重啟排程
#   verify       ：唯讀比對選單畫面與該版本的規格，升版前驗證用
#   ready        ：readiness probe；排程運作中且不在設定或重啟期間才回 0
#   cmd          ：文字模式設定介面（run_cmd.sh），需 docker run -it / docker compose exec
#   stop         ：停止同一容器內的背景排程
#   其他         ：直接執行
set -euo pipefail

cd "${TURNKEY_HOME}"

RUN_DIR=/run/turnkey
READY_FILE="${RUN_DIR}/ready"              # 內容為排程程序的 PID
# configure 執行期間持有此鎖。以鎖判斷「設定中」，configure 被中斷（Ctrl-C、exec 斷線）時不會殘留狀態
SETUP_LOCK="${RUN_DIR}/configure.lock"

# readiness probe 頻繁執行，不做任何初始化、不輸出
if [[ "${1:-start}" == ready ]]; then
    [[ -f "${READY_FILE}" ]] || exit 1
    flock -n "${SETUP_LOCK}" true 2>/dev/null || exit 1
    kill -0 "$(cat "${READY_FILE}")" 2>/dev/null && exit 0
    exit 1
fi

DATA_DIR=${TURNKEY_DATA:-/data}
CONF_DIR="${DATA_DIR}/config"
CONF_FILE="${CONF_DIR}/einvUserConfig.xml"
RESTART_MARKER="${RUN_DIR}/restart-needed"
ENTRYPOINT_PID="${RUN_DIR}/entrypoint.pid"
SETUP=(python3 /opt/turnkey-setup/turnkey_setup.py)
export TURNKEY_SETUP_RESTART_MARKER="${RESTART_MARKER}"

mkdir -p "${CONF_DIR}" "${DATA_DIR}/log" "${RUN_DIR}"

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

setup_requested() {
    [[ -n "${TURNKEY_SETUP_FILE:-}" || -n "${TURNKEY_SENDER_TAX_ID:-}" ]]
}

# 執行 configure；期間 readiness 一律回報未就緒。同時只允許一個 configure
# 以背景執行再 wait，讓呼叫端的 trap 在設定期間也能處理訊號
setup_pid=0
run_setup() {
    exec 9>"${SETUP_LOCK}"
    # 稍等一下：readiness probe 檢查時會短暫取得此鎖
    if ! flock -w 10 9; then
        echo "[entrypoint] 已有 configure 在執行" >&2
        exec 9>&-
        return 1
    fi
    local rc=0
    "${SETUP[@]}" configure "$@" &
    setup_pid=$!
    wait "${setup_pid}" || rc=$?
    setup_pid=0
    exec 9>&-
    return "${rc}"
}

abort_setup() {
    echo "[entrypoint] 收到停止訊號，中止自動設定"
    if [[ ${setup_pid} -gt 0 ]]; then
        kill -TERM "${setup_pid}" 2>/dev/null || true
        wait "${setup_pid}" 2>/dev/null || true
    fi
    exit 143
}

case "${1:-start}" in
    start)
        rm -f "${READY_FILE}" "${RESTART_MARKER}"
        echo $$ > "${ENTRYPOINT_PID}"

        if setup_requested; then
            rc=0
            # 設定期間 docker stop 要能中止；排程尚未啟動，不需要重啟
            trap abort_setup TERM INT
            trap '' HUP
            run_setup || rc=$?
            trap - TERM INT HUP
            # 0：一致；10：已變更（排程尚未啟動，接下來就會讀到新設定）
            if [[ ${rc} -ne 0 && ${rc} -ne 10 ]]; then
                echo "[entrypoint] 自動設定失敗（exit ${rc}），不啟動排程"
                exit 1
            fi
            rm -f "${RESTART_MARKER}"
        fi

        # 尚未完成資料庫設定時排程會立即結束；改為待命，讓使用者能 exec 進來設定
        if ! grep -q '<db-config-ok>true</db-config-ok>' "${CONF_FILE}"; then
            echo "[entrypoint] 尚未完成資料庫設定，排程未啟動。請執行："
            echo "[entrypoint]   docker compose exec turnkey turnkey-entrypoint cmd"
            echo "[entrypoint]   或設定 TURNKEY_SETUP_FILE／TURNKEY_SENDER_TAX_ID 後重啟，由 configure 自動設定"
            echo "[entrypoint] 設定完成後重啟此容器即會啟動排程"
            trap 'exit 0' TERM INT
            # 以 configure 完成設定後會收到 SIGHUP：重新執行 start 流程以啟動排程
            trap 'echo "[entrypoint] 設定已完成，啟動排程"; exec "$0" start' HUP
            sleep infinity &
            wait $!
            exit 0
        fi

        child=0
        start_schedules() {
            ./run_start.sh &
            child=$!
            # 排程程序存活一段時間後才回報就緒；PID 不同（已重啟）或已結束就不寫
            ( sleep "${TURNKEY_READY_DELAY:-15}"; kill -0 "${child}" 2>/dev/null && echo "${child}" > "${READY_FILE}" ) &
            echo "[entrypoint] 排程已啟動（PID ${child}）"
        }
        # 子程序結束後在被 wait 之前是 zombie，kill -0 仍會成功，所以看程序狀態
        alive() {
            local stat
            stat=$(ps -o stat= -p "$1" 2>/dev/null) || return 1
            [[ "${stat}" != Z* ]]
        }
        # 排程剛啟動、尚未開始接收停止指令時 run_stop.sh 可能無效：逾時重送，仍未結束就送 SIGTERM
        wait_stopped() {
            local i
            for (( i = 1; i <= ${TURNKEY_STOP_TIMEOUT:-30}; i++ )); do
                alive "${child}" || break
                sleep 1
                if (( i % 10 == 0 )); then ./run_stop.sh >/dev/null 2>&1 || true; fi
            done
            if alive "${child}"; then
                echo "[entrypoint] run_stop.sh 未能結束排程，改送 SIGTERM"
                pkill -TERM -P "${child}" 2>/dev/null || true
                kill -TERM "${child}" 2>/dev/null || true
            fi
            wait "${child}" 2>/dev/null || true
        }
        stopping=false
        restarting=false
        stop_turnkey() {
            stopping=true
            rm -f "${READY_FILE}"
            echo "[entrypoint] 收到停止訊號，執行 run_stop.sh"
            ./run_stop.sh || true
        }
        restart_turnkey() {
            restarting=true
            rm -f "${READY_FILE}"
            echo "[entrypoint] 設定已變更，重啟排程"
            ./run_stop.sh || true
            wait_stopped
            # 重啟途中收到停止訊號：不再啟動排程，交由主迴圈結束
            [[ "${stopping}" == true ]] && return
            start_schedules
        }
        trap stop_turnkey TERM INT
        trap restart_turnkey HUP

        start_schedules
        while true; do
            rc=0
            wait "${child}" || rc=$?
            if [[ "${stopping}" == true ]]; then
                # trap 觸發後 wait 會提前返回，需再等排程真正結束
                wait_stopped
                exit 0
            fi
            if [[ "${restarting}" == true ]]; then
                restarting=false
                continue
            fi
            # 非主動停止卻結束 → 視為異常，以非 0 退出讓 restart policy 重啟
            rm -f "${READY_FILE}"
            echo "[entrypoint] 排程程序非預期結束（exit ${rc}）"
            exit $(( rc == 0 ? 1 : rc ))
        done
        ;;
    configure)
        shift
        rc=0
        # Ctrl-C 或 exec 連線中斷時一併中止 configure，不留下在背景執行的設定程序
        trap abort_setup TERM INT HUP
        run_setup "$@" || rc=$?
        trap - TERM INT HUP
        if [[ -f "${RESTART_MARKER}" ]]; then
            rm -f "${RESTART_MARKER}"
            if [[ -f "${ENTRYPOINT_PID}" ]] && kill -0 "$(cat "${ENTRYPOINT_PID}")" 2>/dev/null; then
                kill -HUP "$(cat "${ENTRYPOINT_PID}")"
                echo "[entrypoint] 已通知 entrypoint 啟動或重啟排程；完成前 readiness 回報未就緒"
            else
                echo "[entrypoint] 設定已變更；排程未在本容器執行，下次啟動時生效"
            fi
        fi
        exit $(( rc == 10 ? 0 : rc ))
        ;;
    verify)
        shift
        exec "${SETUP[@]}" verify "$@"
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
