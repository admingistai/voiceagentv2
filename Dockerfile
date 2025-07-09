FROM python:3.11-slim

# Install audio libraries that Cartesia/Deepgram need
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ffmpeg libsndfile1 git curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python packages
COPY agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent/ /app/

# healthcheck.py is now copied with the rest of the code

ENV PORT=8080
CMD python healthcheck.py & python main.py start