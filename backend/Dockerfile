# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables to optimize Python container runs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the HuggingFace fastembed model during image build.
# This avoids container startup timeouts and heavy network overhead at runtime on host providers.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

# Copy the rest of the application code
COPY . /app/

# Expose the default port
EXPOSE 8000

# Run uvicorn server binding to 0.0.0.0 and the dynamically provided PORT env var
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port \${PORT:-8000}"
