#!/usr/bin/env bash
#
# ai-jam environment manager
# Usage: ./env.sh {start|stop|restart|status|logs|db:migrate|db:seed}
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/.logs"
PID_DIR="$PROJECT_DIR/.pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

_info()  { echo -e "${CYAN}[ai-jam]${NC} $*"; }
_ok()    { echo -e "${GREEN}[ai-jam]${NC} $*"; }
_warn()  { echo -e "${YELLOW}[ai-jam]${NC} $*"; }
_err()   { echo -e "${RED}[ai-jam]${NC} $*"; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_is_running() {
  local pidfile="$PID_DIR/$1.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(<"$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pidfile"
  fi
  return 1
}

_get_pid() {
  local pidfile="$PID_DIR/$1.pid"
  [[ -f "$pidfile" ]] && cat "$pidfile"
}

_wait_for_port() {
  local port=$1 timeout=${2:-30} elapsed=0
  while ! lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [[ $elapsed -ge $timeout ]]; then
      return 1
    fi
  done
  return 0
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

start_db() {
  _info "Starting PostgreSQL..."
  if docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -q postgres; then
    _ok "PostgreSQL already running"
  else
    docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d postgres
    _info "Waiting for PostgreSQL on port 5433..."
    if _wait_for_port 5433 20; then
      _ok "PostgreSQL ready"
    else
      _err "PostgreSQL failed to start within 20s"
      return 1
    fi
  fi
}

start_backend() {
  if _is_running backend; then
    _ok "Backend already running (PID $(_get_pid backend))"
    return 0
  fi
  _info "Starting backend..."
  cd "$PROJECT_DIR"
  nohup pnpm dev:backend > "$LOG_DIR/backend.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/backend.pid"
  _info "Waiting for backend on port 3002..."
  if _wait_for_port 3002 30; then
    _ok "Backend ready (PID $pid)"
  else
    _warn "Backend may still be starting — check logs: ./env.sh logs backend"
  fi
}

start_frontend() {
  if _is_running frontend; then
    _ok "Frontend already running (PID $(_get_pid frontend))"
    return 0
  fi
  _info "Starting frontend..."
  cd "$PROJECT_DIR"
  nohup pnpm dev:frontend > "$LOG_DIR/frontend.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/frontend.pid"
  _info "Waiting for frontend on port 5174..."
  if _wait_for_port 5174 20; then
    _ok "Frontend ready (PID $pid)"
  else
    _warn "Frontend may still be starting — check logs: ./env.sh logs frontend"
  fi
}

cmd_start() {
  local target="${1:-all}"
  case "$target" in
    db)       start_db ;;
    backend)  start_db && start_backend ;;
    frontend) start_frontend ;;
    all)      start_db && start_backend && start_frontend ;;
    *)        _err "Unknown target: $target"; exit 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------

stop_service() {
  local name=$1
  if _is_running "$name"; then
    local pid
    pid=$(_get_pid "$name")
    _info "Stopping $name (PID $pid)..."
    # Kill entire process group to catch child processes
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_DIR/$name.pid"
    _ok "$name stopped"
  else
    _warn "$name not running"
  fi
}

stop_db() {
  _info "Stopping PostgreSQL..."
  docker compose -f "$PROJECT_DIR/docker-compose.yml" stop postgres
  _ok "PostgreSQL stopped"
}

cmd_stop() {
  local target="${1:-all}"
  case "$target" in
    db)       stop_db ;;
    backend)  stop_service backend ;;
    frontend) stop_service frontend ;;
    all)      stop_service frontend; stop_service backend; stop_db ;;
    *)        _err "Unknown target: $target"; exit 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

_status_line() {
  local name=$1 port=$2
  if _is_running "$name"; then
    echo -e "  ${GREEN}●${NC} $name  PID=$(_get_pid "$name")  port=$port"
  else
    echo -e "  ${RED}○${NC} $name  (not running)"
  fi
}

cmd_status() {
  echo ""
  _info "Environment status:"
  echo ""

  # Postgres
  if docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -q postgres; then
    echo -e "  ${GREEN}●${NC} postgres  port=5433  (docker)"
  else
    echo -e "  ${RED}○${NC} postgres  (not running)"
  fi

  _status_line backend 3002
  _status_line frontend 5174
  echo ""
}

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

cmd_logs() {
  local target="${1:-all}"
  local follow="${2:-}"

  case "$target" in
    db|postgres)
      docker compose -f "$PROJECT_DIR/docker-compose.yml" logs ${follow:+-f} postgres
      ;;
    backend)
      if [[ -f "$LOG_DIR/backend.log" ]]; then
        if [[ "$follow" == "-f" ]]; then
          tail -f "$LOG_DIR/backend.log"
        else
          tail -80 "$LOG_DIR/backend.log"
        fi
      else
        _warn "No backend log found"
      fi
      ;;
    frontend)
      if [[ -f "$LOG_DIR/frontend.log" ]]; then
        if [[ "$follow" == "-f" ]]; then
          tail -f "$LOG_DIR/frontend.log"
        else
          tail -80 "$LOG_DIR/frontend.log"
        fi
      else
        _warn "No frontend log found"
      fi
      ;;
    all)
      _info "=== Backend ==="
      [[ -f "$LOG_DIR/backend.log" ]] && tail -40 "$LOG_DIR/backend.log" || _warn "No backend log"
      echo ""
      _info "=== Frontend ==="
      [[ -f "$LOG_DIR/frontend.log" ]] && tail -40 "$LOG_DIR/frontend.log" || _warn "No frontend log"
      ;;
    *)
      _err "Unknown target: $target"; exit 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# DB commands
# ---------------------------------------------------------------------------

cmd_db_migrate() {
  _info "Running migrations..."
  cd "$PROJECT_DIR"
  pnpm db:migrate
  _ok "Migrations complete"
}

cmd_db_seed() {
  _info "Seeding database..."
  cd "$PROJECT_DIR"
  pnpm db:seed
  _ok "Seed complete"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

cmd_help() {
  cat <<HELP

  ${CYAN}ai-jam environment manager${NC}

  Usage: ./env.sh <command> [target] [flags]

  Commands:
    start   [all|db|backend|frontend]   Start services (default: all)
    stop    [all|db|backend|frontend]   Stop services (default: all)
    restart [all|db|backend|frontend]   Restart services (default: all)
    status                              Show running services
    logs    [all|backend|frontend|db]   Show logs (add -f to follow)
    db:migrate                          Run database migrations
    db:seed                             Seed the database

  Examples:
    ./env.sh start                 # Start everything
    ./env.sh stop backend          # Stop just the backend
    ./env.sh restart backend       # Restart backend
    ./env.sh logs backend -f       # Tail backend logs
    ./env.sh status                # Check what's running

HELP
}

case "${1:-help}" in
  start)      cmd_start "${2:-all}" ;;
  stop)       cmd_stop "${2:-all}" ;;
  restart)    cmd_stop "${2:-all}" && cmd_start "${2:-all}" ;;
  status)     cmd_status ;;
  logs)       cmd_logs "${2:-all}" "${3:-}" ;;
  db:migrate) cmd_db_migrate ;;
  db:seed)    cmd_db_seed ;;
  help|--help|-h) cmd_help ;;
  *)          _err "Unknown command: $1"; cmd_help; exit 1 ;;
esac
