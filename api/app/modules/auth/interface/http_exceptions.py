"""HTTP exceptions for authentication interface responses."""

from fastapi import HTTPException, status


class AuthHTTPException(HTTPException):
    """Base HTTP exception for authentication errors."""

    pass


class AuthUnauthorizedHTTPException(AuthHTTPException):
    """HTTP exception for unauthorized authentication requests."""

    def __init__(self, detail: str) -> None:
        """Initialize an unauthorized authentication exception.

        Args:
            detail: Client-facing error detail for the response body.
        """
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthServiceUnavailableHTTPException(AuthHTTPException):
    """HTTP exception for unavailable authentication dependencies."""

    def __init__(self, detail: str) -> None:
        """Initialize an authentication service unavailable exception.

        Args:
            detail: Client-facing error detail for the response body.
        """
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
