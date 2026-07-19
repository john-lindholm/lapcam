FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-venv \
    libavformat-dev \
    libavfilter-dev \
    libavdevice-dev \
    ffmpeg \
    libjpeg-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy client code
COPY . .

# Create buffer directory
RUN mkdir -p /tmp/lapcam-buffer

CMD ["python", "main.py", "--config", "config.yaml"]
