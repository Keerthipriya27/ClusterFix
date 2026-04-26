FROM python:3.10-slim

WORKDIR /app

# Install only runtime dependencies for Space serving.
COPY requirements-space.txt .
RUN pip install --no-cache-dir -r requirements-space.txt

# Copy all project files
COPY . .

# Expose Space port
EXPOSE 7860

# Run Flask server
CMD ["python", "custerfix-ui/server.py"]
