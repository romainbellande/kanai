class AuthDomainException(Exception):
    """Base exception for auth-domain failures."""

    def __init__(self, message: str, original_error: Exception | None = None) -> None:
        self.message = message
        self.original_error = original_error
        super().__init__(message)


class InvalidTokenException(AuthDomainException):
    """Raised when a bearer token is malformed, expired, or otherwise invalid."""


class AuthenticationServiceException(AuthDomainException):
    """Raised when discovery, JWKS, or Redis infrastructure prevents auth."""
