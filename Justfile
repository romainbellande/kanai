set dotenv-load

dev:
    #!/usr/bin/env bash
    echo "Starting client on http://localhost:3000"
    (cd client && bun run dev) &
    CLIENT_PID=$!
    echo "Starting api on http://localhost:8000"
    (cd api && uv run fastapi dev --port 8000) &
    API_PID=$!
    echo "Applications running (client=$CLIENT_PID, api=$API_PID). Press Ctrl+C to stop."
    trap "kill $CLIENT_PID $API_PID 2>/dev/null" EXIT
    wait

pre-commit:
    uv --directory ./api run lefthook run pre-commit --force