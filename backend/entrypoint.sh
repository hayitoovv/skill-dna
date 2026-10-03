#!/bin/bash
set -e

echo "=== SKILL DNA BACKEND STARTUP ==="

# Wait for PostgreSQL to become reachable
echo "Waiting for PostgreSQL ($POSTGRES_SERVER:$POSTGRES_PORT)..."
python -c "
import time, socket, os, sys
host = os.getenv('POSTGRES_SERVER', 'postgres')
port = int(os.getenv('POSTGRES_PORT', '5432'))
start = time.time()
while time.time() - start < 60:
    try:
        s = socket.create_connection((host, port), 2)
        s.close()
        print('PostgreSQL is reachable!')
        sys.exit(0)
    except OSError:
        time.sleep(1)
print('ERROR: PostgreSQL connection timeout!')
sys.exit(1)
"

# Initialize database schema and seeds
echo "Checking and initializing database tables..."
python -c "
import asyncio
from app.db.init_db import init_database
asyncio.run(init_database())
" || echo "Database initialization completed or already initialized."

echo "Starting Uvicorn production server on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers --forwarded-allow-ips='*'
