# app/utils/logger.py
"""
Centralized logging configuration for the application
"""
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Create logs directory if it doesn't exist
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# Custom formatter with more details
class DetailedFormatter(logging.Formatter):
    """Custom formatter with color support for console and detailed file logs"""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    def format(self, record):
        # Add color to console output
        if hasattr(sys.stderr, 'isatty') and sys.stderr.isatty():
            levelname = record.levelname
            if levelname in self.COLORS:
                record.levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"
        
        # Format the message
        return super().format(record)


def setup_logger(name: str = "aquilus") -> logging.Logger:
    """
    Set up application logger with both file and console handlers
    
    Args:
        name: Logger name (default: "aquilus")
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # Prevent duplicate handlers
    if logger.handlers:
        return logger
    
    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = DetailedFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    
    # File handler with full details
    log_file = LOG_DIR / f"aquilus_{datetime.now().strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_format = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(filename)s:%(funcName)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_format)
    
    # Error file handler for errors only
    error_log_file = LOG_DIR / f"errors_{datetime.now().strftime('%Y%m%d')}.log"
    error_handler = logging.FileHandler(error_log_file, encoding='utf-8')
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_format)
    
    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    logger.addHandler(error_handler)
    
    return logger


# Create default logger
logger = setup_logger()


def log_request(method: str, path: str, user_id: Optional[str] = None, **kwargs):
    """Log incoming HTTP request with details"""
    extra_info = " | ".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
    user_info = f"user={user_id}" if user_id else "anonymous"
    logger.info(f"REQUEST {method} {path} | {user_info}{' | ' + extra_info if extra_info else ''}")


def log_response(method: str, path: str, status_code: int, duration_ms: Optional[float] = None):
    """Log HTTP response with status and timing"""
    duration_str = f" | {duration_ms:.2f}ms" if duration_ms else ""
    logger.info(f"RESPONSE {method} {path} | status={status_code}{duration_str}")


def log_error(error: Exception, context: Optional[str] = None, **kwargs):
    """Log error with full context and traceback"""
    import traceback
    
    error_type = type(error).__name__
    error_msg = str(error)
    
    context_str = f" | context={context}" if context else ""
    extra_info = " | ".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
    
    # Log error message first
    logger.error(
        f"ERROR {error_type}: {error_msg}{context_str}{' | ' + extra_info if extra_info else ''}"
    )
    
    # Log full traceback at ERROR level so it's always visible
    tb = traceback.format_exc()
    logger.error(f"Traceback:\n{tb}")


def log_database_query(operation: str, table: str, filters: Optional[dict] = None, **kwargs):
    """Log database operations"""
    filter_str = f"filters={filters}" if filters else ""
    extra_info = " | ".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
    logger.debug(
        f"DB {operation} {table}{' | ' + filter_str if filter_str else ''}{' | ' + extra_info if extra_info else ''}"
    )


def log_auth_event(event_type: str, user_id: Optional[str] = None, success: bool = True, **kwargs):
    """Log authentication events"""
    status = "SUCCESS" if success else "FAILED"
    user_info = f"user={user_id}" if user_id else "anonymous"
    extra_info = " | ".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
    
    level = logging.INFO if success else logging.WARNING
    logger.log(
        level,
        f"AUTH {event_type} {status} | {user_info}{' | ' + extra_info if extra_info else ''}"
    )
