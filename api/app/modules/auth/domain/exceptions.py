"""Domain exceptions raised by authentication business logic."""


class AuthDomainException(Exception):
    """Base exception for auth-domain failures."""

    def __init__(self, message: str, original_error: Exception | None = None) -> None:
        """Initialize the exception with a safe message and optional cause.

        Args:
            message: Human-readable description of the authentication failure.
            original_error: Lower-level exception that caused this failure, if any.
        """
        self.message = message
        self.original_error = original_error
        super().__init__(message)


class InvalidTokenException(AuthDomainException):
    """Raised when a bearer token is malformed, expired, or otherwise invalid."""


class AuthenticationServiceException(AuthDomainException):
    """Raised when supporting services prevent authentication."""
