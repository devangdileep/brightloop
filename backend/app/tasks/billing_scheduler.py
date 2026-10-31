import asyncio
import logging
from datetime import datetime
from app.services.billing_service import BillingService

logger = logging.getLogger("brightloop.scheduler")


async def run_billing_worker(interval_seconds: int = 86400) -> None:
    """
    Background worker loop that triggers recurring billing periodically.
    Safe with database-level idempotency (unique constraint on subscription_id + period).
    Note: In multi-instance Render environments, prefer triggering via Supabase Cron (cron.sql)
    or a dedicated single Render Cron Job calling POST /api/v1/billing/run with BILLING_CRON_SECRET.
    """
    logger.info(f"Starting billing scheduler background worker (interval: {interval_seconds}s)")
    while True:
        try:
            logger.info("Executing scheduled recurring billing cycle...")
            result = await BillingService.run_billing_cycle()
            logger.info(f"Scheduled billing cycle completed: {result}")
        except Exception as e:
            logger.error(f"Error in scheduled billing worker: {e}", exc_info=True)

        await asyncio.sleep(interval_seconds)
