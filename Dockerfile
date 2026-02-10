# Multi-stage build for Parking Garage Demo
# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy markdown docs that frontend imports via @docs alias
COPY README.md ./
COPY PRD.md ./
COPY PRICING_LOGIC.md ./

# Copy and build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend with built frontend
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Railway sets PORT env var, default to 8000
ENV PORT=8000
EXPOSE $PORT

# Start the server (shell form to expand $PORT)
CMD python3 -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
