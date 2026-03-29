from fastapi import HTTPException, status


class AuthHTTPException(HTTPException):
    pass


class AuthUnauthorizedHTTPException(AuthHTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthServiceUnavailableHTTPException(AuthHTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
