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
    bunx @openapitools/openapi-generator-cli generate -i http://localhost:8000/openapi.json -g typescript-fetch -o src/api/openapi-client

install-gitleaks:
    #!/usr/bin/env bash
    set -euo pipefail

    install_dir="${GITLEAKS_INSTALL_DIR:-$HOME/.local/bin}"
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    python_bin="$(command -v python3 || true)"
    if [ -z "$python_bin" ]; then
      python_bin="$(command -v python || true)"
    fi
    if [ -z "$python_bin" ]; then
      echo "python3 or python is required to read the GitHub release metadata." >&2
      exit 1
    fi

    tag="$(curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/latest | "$python_bin" -c 'import json, sys; print(json.load(sys.stdin)["tag_name"])')"
    version="${tag#v}"

    case "$(uname -s)" in
      Linux) os="linux" ;;
      Darwin) os="darwin" ;;
      *) echo "Unsupported OS: $(uname -s). Install gitleaks manually from https://github.com/gitleaks/gitleaks/releases" >&2; exit 1 ;;
    esac

    case "$(uname -m)" in
      x86_64|amd64) arch="x64" ;;
      arm64|aarch64) arch="arm64" ;;
      armv7l) arch="armv7" ;;
      armv6l) arch="armv6" ;;
      i386|i686) arch="x32" ;;
      *) echo "Unsupported architecture: $(uname -m). Install gitleaks manually from https://github.com/gitleaks/gitleaks/releases" >&2; exit 1 ;;
    esac

    asset="gitleaks_${version}_${os}_${arch}.tar.gz"
    base_url="https://github.com/gitleaks/gitleaks/releases/download/${tag}"

    curl -fsSL "${base_url}/${asset}" -o "${tmp_dir}/${asset}"
    curl -fsSL "${base_url}/gitleaks_${version}_checksums.txt" -o "${tmp_dir}/checksums.txt"

    if command -v sha256sum >/dev/null 2>&1; then
      (cd "$tmp_dir" && grep -F "  ${asset}" checksums.txt | sha256sum -c -)
    elif command -v shasum >/dev/null 2>&1; then
      (cd "$tmp_dir" && grep -F "  ${asset}" checksums.txt | shasum -a 256 -c -)
    else
      echo "No SHA-256 tool found; skipping checksum verification." >&2
    fi

    tar -xzf "${tmp_dir}/${asset}" -C "$tmp_dir" gitleaks
    mkdir -p "$install_dir"
    install -m 755 "${tmp_dir}/gitleaks" "${install_dir}/gitleaks"

    "${install_dir}/gitleaks" version
    echo "Installed gitleaks to ${install_dir}/gitleaks"
    case ":$PATH:" in
      *":${install_dir}:"*) ;;
      *) echo "Add ${install_dir} to PATH so Lefthook can find gitleaks." ;;
    esac
