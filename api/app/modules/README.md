# Modules

Add new non-trivial backend capabilities under `app/modules/<context_name>/`.

When a module owns meaningful business rules or external integrations, promote it into a bounded context with:

- `domain/` for core business models and rules
- `application/` for use cases and ports
- `infrastructure/` for adapters such as persistence or third-party clients
- `interface/` for FastAPI and Starlette delivery concerns such as routers and middleware

`app/modules/auth/` is the reference example for this layout, including a thin `bootstrap.py` composition entrypoint for wiring the context into `main.py`.

Keep a module flat when the behavior is still trivial, such as a small route with no real business rules or integrations yet. `app/modules/user/` is still acceptable in that simpler shape.

Keep `main.py` as the top-level FastAPI composition point. Routers, startup hooks, and context-specific adapters should stay with the owning module.

Reserve `app/services/` for shared technical services like database and Redis helpers. Do not put feature-specific policy or module logic there.
