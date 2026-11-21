#!/bin/bash
source /home/claude/work/e2e/env.sh
export PGRST_DB_URI="postgres://authenticator@localhost:54329/sws_e2e?host=/tmp" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1 PGRST_DB_CHANNEL_ENABLED=true
exec /home/claude/work/bin/dl/postgrest
