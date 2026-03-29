class DatabaseConnectionException(Exception):
    """Exception raised when database connection fails."""

    def __init__(self, message="Failed to connect to database", original_error=None):
        self.message = message
        self.original_error = original_error
        super().__init__(self.message)


class RedisServiceException(Exception):
    """Base exception for Redis service failures."""

    def __init__(self, message: str, original_error: Exception | None = None):
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
