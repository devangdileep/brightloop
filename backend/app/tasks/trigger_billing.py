import logging
import os
import sys
import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("brightloop.cron")


def run_trigger() -> int:
    backend_url = os.environ.get("BACKEND_URL", "").strip()
    secret = os.environ.get("BILLING_CRON_SECRET", "").strip()

    if not backend_url:
        logger.error("BACKEND_URL environment variable is not set")
        return 1

    # Ensure valid HTTPS URL scheme if not provided
    if not backend_url.startswith("http://") and not backend_url.startswith("https://"):
        base_url = f"https://{backend_url}"
    else:
        base_url = backend_url

    endpoint = f"{base_url.rstrip('/')}/api/v1/billing/run"
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = f"Bearer {secret}"

    logger.info(f"Triggering recurring billing run at: {endpoint}")
    try:
        with httpx.Client(timeout=90.0) as client:
            resp = client.post(endpoint, headers=headers)
            logger.info(f"Billing endpoint HTTP status: {resp.status_code}")

            if resp.status_code != 200:
                logger.error(f"Billing endpoint returned non-200 status: {resp.status_code} - {resp.text}")
                return 1

            try:
                data = resp.json()
            except Exception as json_err:
                logger.error(f"Failed to parse JSON response from billing run: {json_err}")
                return 1

            if not data.get("ok", False):
                logger.error(f"Billing run completed with errors: {data}")
                return 1

            logger.info(
                f"Billing run succeeded: created={data.get('created', 0)}, "
                f"skipped={data.get('skipped', 0)}, failed={data.get('failed', 0)}"
            )
            return 0

    except httpx.TimeoutException as timeout_err:
        logger.error(f"Timed out waiting for billing endpoint: {timeout_err}")
        return 1
    except httpx.RequestError as req_err:
        logger.error(f"Network error communicating with billing endpoint: {req_err}")
        return 1
    except Exception as exc:
        logger.error(f"Unexpected error executing billing trigger: {exc}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = run_trigger()
    sys.exit(exit_code)
