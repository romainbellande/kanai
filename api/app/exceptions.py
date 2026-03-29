class DatabaseConnectionException(Exception):
    """Exception raised when database connection fails."""

    def __init__(self, message="Failed to connect to database", original_error=None):
        self.message = message
        self.original_error = original_error
        super().__init__(self.message)
