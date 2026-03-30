# Authentication Spec

## Goal

Add request authentication to the FastAPI app with a pure ASGI middleware that:

- authenticates bearer tokens with `joserfc`
- loads OpenID discovery metadata from `settings.auth.discovery_endpoint`
- loads JWKS data from the discovery document
- caches discovery and JWKS responses for 1 hour
- reuses Redis for server-side session storage
- raises app-defined authentication HTTP exceptions
- includes unit test coverage for the full behavior

## Existing Integration Points

This work should align with the current backend structure:

- `app/config.py` already exposes `settings.auth.discovery_endpoint`
- `app/services/redis_service.py` already provides the shared Redis client and JSON-backed persistence pattern
- `main.py` is the app composition point and should mount the middleware there
- `tests/test_redis_service.py` shows the current async pytest style and fake Redis approach

The implementation should stay local to the auth concern and avoid unrelated refactors.

## DDD Architecture

Authentication must be implemented as a dedicated bounded context under `app/modules/auth/`.

This feature should follow a DDD-oriented split with four layers:

- domain: auth business concepts and invariants
- application: auth use cases and orchestration
- infrastructure: external systems and library adapters
- interface: FastAPI/ASGI entry points

The auth bounded context must own its own models, contracts, and orchestration. It may reuse shared technical building blocks that already exist in the codebase, such as `RedisService`, but auth rules and auth flow must remain inside the auth module rather than leaking into generic top-level services.

## Required Components

The final implementation should introduce the following auth-focused units, or their equivalent responsibilities if names differ slightly:

- `AuthMiddleware`: pure ASGI middleware that acts as the interface-layer entry point
- `AuthenticateRequest` use case or equivalent application service
- `Session` domain model and related auth value objects
- `SessionRepository` domain contract
- infrastructure adapters for Redis-backed sessions, discovery/JWKS loading, and `joserfc` token verification
- auth-specific HTTP exceptions for expected client-facing failures

Suggested file layout:

- `app/modules/auth/domain/session.py`
- `app/modules/auth/domain/value_objects.py`
- `app/modules/auth/domain/repositories.py`
- `app/modules/auth/domain/exceptions.py`
- `app/modules/auth/application/authenticate_request.py`
- `app/modules/auth/application/dto.py`
- `app/modules/auth/infrastructure/redis_session_repository.py`
- `app/modules/auth/infrastructure/oidc_metadata_provider.py`
- `app/modules/auth/infrastructure/joserfc_token_verifier.py`
- `app/modules/auth/interface/auth_middleware.py`
- `tests/modules/auth/test_auth_middleware.py`
- `tests/modules/auth/test_session_repository.py`
- `tests/modules/auth/test_oidc_metadata_provider.py`
- `tests/modules/auth/test_authenticate_request.py`

The exact file split may be adjusted, but the responsibilities above must remain distinct.

## Layer Responsibilities

### Domain layer

The domain layer must define the core auth concepts without depending on FastAPI, Redis, or `joserfc`.

It should own:

- the `Session` model
- token fingerprint and expiry-related value objects if needed
- auth domain invariants such as session expiration rules
- repository contracts such as `SessionRepository`

The domain layer must not import infrastructure or framework code.

### Application layer

The application layer must orchestrate authentication behavior.

It should own:

- the main request-authentication use case
- the decision flow for session reuse versus token validation
- session creation or refresh after successful token validation
- the authenticated context returned to the interface layer

The application layer may depend on domain contracts and abstractions, but it must not know Redis-specific or HTTP-client-specific implementation details.

### Infrastructure layer

The infrastructure layer must adapt external dependencies to domain and application contracts.

It should own:

- the Redis-backed `SessionRepository` implementation, reusing the shared `RedisService`
- the discovery and JWKS fetch/caching adapter
- the `joserfc` token verification adapter

Infrastructure code may depend on third-party libraries and app-level technical services, but it should not contain the core request-authentication decision flow.

### Interface layer

The interface layer must remain thin.

It should own:

- pure ASGI middleware wiring
- request header extraction
- whitelist path bypass
- writing authenticated context into `scope["auth"]`
- translating expected auth failures into FastAPI-compatible HTTP responses

The middleware should delegate authentication decisions to the application layer rather than implementing them inline.

## AuthMiddleware

### Middleware style

- The middleware must be implemented as a pure ASGI middleware following Starlette's pure ASGI middleware pattern.
- It must not use `BaseHTTPMiddleware`.
- It must be mounted centrally from `main.py`.

### Constructor

The middleware constructor must accept an optional whitelist of URL paths that bypass authentication.

Expected behavior:

- if the request path is whitelisted, the middleware must forward the request without auth checks
- if the request path is not whitelisted, the middleware must enforce authentication
- whitelist matching should be exact path matching unless implementation constraints require a different small extension, in which case the behavior must be documented in code and tests

### Request flow

For non-whitelisted requests, the middleware must follow this order:

1. Read the `Authorization` header.
2. Require the `Bearer <token>` format.
3. Call the auth application use case, which checks through the `SessionRepository` contract whether a valid server-side session already exists for that bearer token.
4. If a valid session exists, authenticate the request from session data without refetching discovery or JWKS data and without revalidating the JWT.
5. If no valid session exists, fetch cached discovery metadata and cached JWKS data, then validate the bearer token with `joserfc`.
6. If token validation succeeds, create or refresh the session in Redis.
7. Attach the authenticated context to the ASGI scope and continue the request.

### Auth context in scope

After successful authentication, the middleware must expose authenticated data through the ASGI scope so downstream handlers can read it without repeating token validation.

Required scope contract:

- `scope["auth"]` must contain a structured auth/session object
- the object should include, at minimum:
  - `subject`
  - `issuer`
  - `expires_at`
  - any additional lightweight claims the API explicitly needs

The implementation should avoid storing unnecessary or sensitive token data in the scope.

## Session Management

### Purpose

Implement session management inside the auth bounded context, with an application-facing session workflow backed by a repository that reuses the existing shared `RedisService` instance.

The session component must:

- use the existing Redis client lifecycle instead of creating a separate Redis connection pattern
- persist a minimal Pydantic-backed session payload
- load, create, refresh, and delete sessions as needed by the middleware

Recommended DDD split:

- domain: `Session` model and repository contract
- application: session lookup/store orchestration as part of the authenticate-request use case
- infrastructure: Redis repository implementation

### Session lookup contract

The authentication flow must not introduce a separate session ID header or cookie.

The only client credential is:

- `Authorization: Bearer <token>`

Session lookup must work as follows:

- the auth application layer receives the bearer token string
- it asks the session repository for a matching session using deterministic key derivation rules
- it derives a deterministic Redis key from the token
- the derived key should be based on a one-way fingerprint of the token, such as a SHA-256 hash
- the raw token must not be used directly as the Redis key when a stable fingerprint can be used instead

### Session payload

Each session record must store only the minimum reusable authentication state needed for later requests.

Required fields:

- subject / user identifier
- issuer
- expiration timestamp

Optional fields:

- audience
- lightweight claims required by protected endpoints

The session payload should be represented by a Pydantic model so it follows the same validation style used elsewhere in the codebase.

### Session expiration

Session lifetime must never exceed the validated token lifetime.

Required behavior:

- if the JWT is already expired, the middleware must reject the request and must not create a session
- when creating a session, Redis TTL must be capped so it does not outlive the token `exp` claim
- if an existing session is expired, it must be treated as missing
- if practical, expired sessions may be deleted eagerly when encountered

### Redis key scheme

The implementation should use a dedicated auth namespace, for example `auth:sessions:<fingerprint>`.

The final key format must be:

- stable
- deterministic for the same bearer token
- isolated from unrelated Redis data

## Discovery Metadata And JWKS

### Discovery lookup

Token validation must begin from the discovery endpoint configured in `settings.auth.discovery_endpoint`.

Required behavior:

- fetch the OpenID discovery document from the configured endpoint
- require the document to contain a valid `jwks_uri`
- use the discovered `jwks_uri` to fetch JWKS data

The implementation must not hardcode the JWKS URL separately from discovery.

### Caching

Discovery metadata and JWKS data must both be cached with `cachetools` using `TTLCache`.

Required cache rules:

- discovery metadata TTL must be 1 hour
- JWKS data TTL must be 1 hour
- the implementation should use the `@cached(cache=TTLCache(...))` pattern or an equivalent `cachetools` approach with the same behavior
- caching must avoid unnecessary remote calls during repeated authenticated requests

Recommended cache size:

- `maxsize=1024`

### Remote fetch behavior

The discovery and JWKS fetch layer should live in infrastructure and be isolated so it can be tested independently from the middleware and application use case.

That component must:

- return parsed discovery metadata
- return parsed JWKS data in the form expected by `joserfc`
- translate malformed remote data into app-defined authentication exceptions
- translate network failures into app-defined authentication exceptions

## JWT Validation

JWT validation must use `joserfc`.

Required behavior:

- validate the bearer token signature against the discovered JWKS set
- reject malformed, expired, or otherwise invalid tokens
- require claims needed to establish the authenticated session, at minimum `sub`, `iss`, and `exp`

If additional claim validation such as `aud` is required by the final implementation, it must be documented in code and covered by tests.

## Error Handling

Authentication failures must raise custom HTTP exceptions rather than exposing low-level library errors.

Required behavior:

- define app-specific authentication exception types that inherit from `HTTPException` or otherwise wrap it consistently for FastAPI
- do not leak raw exceptions from `joserfc`, HTTP clients, Redis, or parsing code to API responses
- return stable, client-safe error messages

Expected failure cases that must map to auth-specific HTTP exceptions:

- missing `Authorization` header
- malformed `Authorization` header
- unsupported auth scheme
- expired token
- invalid token signature or claims
- discovery endpoint fetch failure
- malformed discovery response
- missing or invalid `jwks_uri`
- JWKS fetch failure
- malformed JWKS response
- Redis-backed session read/write failure when it prevents authentication

Recommended response codes:

- `401 Unauthorized` for missing, malformed, expired, or invalid credentials
- `503 Service Unavailable` for upstream discovery/JWKS fetch failures or infrastructure failures that prevent validation

If a narrower status mapping is chosen during implementation, it must be applied consistently and documented in tests.

## Testing

The work must include unit tests.

### Middleware tests

Add unit tests that cover at least:

- whitelisted paths bypass authentication
- missing `Authorization` header returns the expected auth exception
- malformed `Authorization` header returns the expected auth exception
- unsupported auth scheme returns the expected auth exception
- existing valid session authenticates the request without remote metadata fetch
- missing session triggers discovery fetch, JWKS fetch, JWT validation, and session creation
- expired session is treated as missing and forces JWT revalidation
- successful authentication attaches `scope["auth"]`

### Session service tests

Add unit tests that cover at least:

- deterministic key derivation from the same token
- different tokens producing different keys
- session creation through the shared Redis service
- session lookup success
- expired session handling
- TTL capped by token expiration

### Metadata cache tests

Add unit tests that cover at least:

- discovery data is fetched once and then served from cache
- JWKS data is fetched once and then served from cache
- discovery fetch failure maps to the expected auth exception
- malformed discovery payload maps to the expected auth exception
- missing `jwks_uri` maps to the expected auth exception
- JWKS fetch failure maps to the expected auth exception
- malformed JWKS payload maps to the expected auth exception

### Test approach

- follow the existing async pytest style already used in backend tests
- prefer isolated unit tests over broad integration tests for this feature
- use fake Redis or the existing Redis test approach for session tests
- mock outbound HTTP calls for discovery and JWKS fetches
- mock or isolate `joserfc` validation behavior where necessary to keep tests deterministic

## App Wiring

The final implementation must:

- register the middleware in `main.py`
- preserve the existing app lifespan behavior
- avoid introducing a second Redis lifecycle manager
- instantiate auth dependencies so the interface layer depends on the auth application layer, and the application layer depends on auth contracts plus infrastructure adapters

Protected routes should work without route-level auth code once the middleware is mounted.

## Non-Goals

This spec does not require:

- refresh token flows
- logout endpoints
- role or permission enforcement beyond basic authentication
- cookie-based sessions
- a custom session ID header
- broad refactors outside the auth-related files
