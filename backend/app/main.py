import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
)
from app.routers import (
    auth,
    billing,
    customers,
    dashboard,
    discounts,
    invoices,
    payments,
    plans,
    products,
    profiles,
    quotation_templates,
    quotations,
    reports,
    settings as app_settings_router,
    subscriptions,
    taxes,
    variants,
)

# Logging configuration
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("brightloop.main")

app = FastAPI(
    title="Brightloop Subscription Management API",
    description="REST API connecting the Brightloop frontend to the Supabase database with recurring billing, quotations, invoices, and payments.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# CORS Middleware
origins = settings.cors_origins
logger.info(f"Configuring CORS for origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health checks
@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "brightloop-backend",
        "version": "1.0.0",
    }


# Include Routers under /api/v1
api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(profiles.router, prefix=api_prefix)
app.include_router(customers.router, prefix=api_prefix)
app.include_router(products.router, prefix=api_prefix)
app.include_router(variants.router, prefix=api_prefix)
app.include_router(plans.router, prefix=api_prefix)
app.include_router(taxes.router, prefix=api_prefix)
app.include_router(discounts.router, prefix=api_prefix)
app.include_router(quotations.router, prefix=api_prefix)
app.include_router(quotation_templates.router, prefix=api_prefix)
app.include_router(subscriptions.router, prefix=api_prefix)
app.include_router(invoices.router, prefix=api_prefix)
app.include_router(payments.router, prefix=api_prefix)
app.include_router(billing.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(app_settings_router.router, prefix=api_prefix)


@app.on_event("startup")
async def on_startup():
    logger.info("Starting Brightloop Backend...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Supabase URL: {settings.SUPABASE_URL}")
