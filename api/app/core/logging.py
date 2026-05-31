"""Configure application logging through Loguru."""

from loguru import logger
import logging
import sys


class InterceptHandler(logging.Handler):
    """Route standard logging records through Loguru."""

    def emit(self, record):
        """Emit a standard logging record through Loguru.

        Args:
            record: The standard logging record to emit.
        """
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        # Walk up to find the caller of the log record
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def init():
    """Initialize application logging handlers and formatting."""

    # Remove default Loguru handlers
    logger.remove()

    # Add custom sink (stdout + formatting)
    logger.add(
        sys.stderr,
        level="DEBUG",
        enqueue=True,
        # https://loguru.readthedocs.io/en/stable/api/logger.html#loguru._logger.Logger.add
        format="[<level>{level}</level>] <green>{time:YYYY-MM-DD at HH:mm:ss}</green> <magenta>{name}.{function}:{line}</magenta> <level>{message}</level>",
    )

    # Intercept standard logging
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # Redirect specific libraries to Loguru
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]:
        logging.getLogger(name).handlers = [InterceptHandler()]
        logging.getLogger(name).propagate = False
