# Use an official lightweight Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CHAINLIT_DISABLE_ORIGIN_CHECK=true

# Set working directory in container
WORKDIR /app

# Copy requirements from frontend directory and install them
COPY frontend/requirements.txt ./frontend/
RUN pip install --no-cache-dir -r frontend/requirements.txt

# Copy the rest of the frontend files
COPY frontend/ ./frontend/

# Expose port 8000 (Railway will override this via the PORT environment variable)
EXPOSE 8000

# Set working directory to the frontend directory so chainlit runs in the correct context
WORKDIR /app/frontend

# Run Chainlit on host 0.0.0.0 and dynamic port set by Railway ($PORT)
CMD ["sh", "-c", "chainlit run app.py --host 0.0.0.0 --port ${PORT:-8000} -h"]
