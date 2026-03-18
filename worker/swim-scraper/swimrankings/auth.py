"""Credential storage and login handling."""

import json
import os
import time
import logging
from pathlib import Path
from DrissionPage import ChromiumPage

log = logging.getLogger(__name__)

DEFAULT_CRED_FILE = Path.home() / ".swimrankings_creds.json"


def save_credentials(email: str, password: str, path: Path = DEFAULT_CRED_FILE):
    path.write_text(json.dumps({"email": email, "password": password}), encoding="utf-8")
    path.chmod(0o600)
    log.info(f"Credentials saved to {path}")


def load_credentials(path: Path = DEFAULT_CRED_FILE) -> tuple[str, str] | None:
    email = os.environ.get("SWIMRANKINGS_EMAIL")
    password = os.environ.get("SWIMRANKINGS_PASSWORD")
    if email and password:
        return email, password
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return data["email"], data["password"]
    return None


def login(page: ChromiumPage, email: str, password: str) -> bool:
    log.info(f"Logging in as {email}...")
    try:
        login_btn = page.ele("#loginButton", timeout=5)
        if login_btn:
            login_btn.click()
            time.sleep(1)
    except Exception:
        pass

    try:
        email_input = page.ele("#email", timeout=5)
        password_input = page.ele("#password", timeout=5)
        if not email_input or not password_input:
            log.error("Could not find login form fields")
            return False

        email_input.clear()
        email_input.input(email)
        password_input.clear()
        password_input.input(password)

        submit_btn = page.ele("#login", timeout=5)
        if submit_btn:
            submit_btn.click()
            time.sleep(3)

        html = page.html or ""
        if "Log Out" in html or "logoutButton" in html:
            log.info("Login successful")
            return True
        log.warning("Login may have failed — no logout button found")
        return True
    except Exception as e:
        log.error(f"Login error: {e}")
        return False


def is_logged_in(page: ChromiumPage) -> bool:
    try:
        html = page.html or ""
        if any(m in html for m in ["Log Out", "logoutButton", "myProfile"]):
            return True
        return False
    except Exception:
        return False
