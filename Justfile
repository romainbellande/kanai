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

[working-directory: 'api']
dev-api:
    uv run fastapi dev --port 8000

[working-directory: 'client']
dev-client:
    bun run dev

pre-commit:
    uv --directory ./api run lefthook run pre-commit --force

[working-directory: 'client']
gen-openapi-client:
    bunx @openapitools/openapi-generator-cli generate -i http://localhost:8000/openapi.json -g typescript-fetch -o src/api-client