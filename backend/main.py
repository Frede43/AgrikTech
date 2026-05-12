from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.database import engine
import backend.models as models
import backend.config as config
from backend.routers import auth, market, admin, products, orders, wallet, disputes, community, categories, stats, users, testimonials, notifications, platform, support, reviews, cart, stock_movements, weather

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AgriConnect Burundi API", description="Backend pour le projet AgriConnect Burundi")

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routers
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(wallet.router)
app.include_router(disputes.router)
app.include_router(community.router)
app.include_router(categories.router)
app.include_router(stats.router)
app.include_router(users.router)
app.include_router(testimonials.router)
app.include_router(notifications.router)
app.include_router(platform.router)
app.include_router(support.router)
app.include_router(reviews.router)
app.include_router(cart.router)
app.include_router(stock_movements.router)
app.include_router(weather.router)

# Health check endpoint for connection detection
@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# Mount Static Files (for product images, kyc docs)
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API AgriConnect Burundi", "status": "online"}
