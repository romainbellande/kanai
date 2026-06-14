# A2A 1.0 SDK protocol boundary

Kanai targets A2A protocol 1.0 end-to-end and lets the official A2A SDKs own the protocol boundary: `a2a-python` route factories and executors on the API, and the A2A JavaScript SDK client on the frontend. We chose this over keeping hand-written JSON-RPC routes with SDK types only because A2A 1.0 streaming has strict task lifecycle rules, and SDK ownership reduces local protocol code while preserving Kanai-specific bearer authentication, Project access checks, and agent-scoped URLs.
