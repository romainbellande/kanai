"""Application-specific exception types for backend services."""


class DatabaseConnectionException(Exception):
    """Exception raised when database connection fails."""

    def __init__(self, message="Failed to connect to database", original_error=None):
        """Initialize the database connection exception.

        Args:
            message: User-facing error message. Defaults to
                "Failed to connect to database".
            original_error: Underlying exception that caused the connection failure.
        """
        self.message = message
        self.original_error = original_error
        super().__init__(self.message)


class RedisServiceException(Exception):
    """Base exception for Redis service failures."""

    def __init__(self, message: str, original_error: Exception | None = None):
        """Initialize the Redis service exception.

        Args:
            message: User-facing error message.
            original_error: Underlying exception that caused the Redis service failure.
                Defaults to None.
        """
        self.message = message
        self.original_error = original_error
        super().__init__(self.message)


class RedisConnectionException(RedisServiceException):
    """Raised when a Redis command or connection operation fails."""


class RedisKeyAlreadyExistsException(RedisServiceException):
    """Raised when create is called for an already existing Redis key."""


class RedisKeyNotFoundException(RedisServiceException):
    """Raised when a Redis key is required but missing."""


class RedisDataValidationException(RedisServiceException):
    """Raised when stored Redis data cannot be parsed into the requested model."""


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
