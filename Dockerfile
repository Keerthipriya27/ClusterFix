FROM python:3.10-slim

WORKDIR /app

# Install dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Expose Space port
EXPOSE 7860

# Run Flask server
CMD ["python", "custerfix-ui/server.py"]
