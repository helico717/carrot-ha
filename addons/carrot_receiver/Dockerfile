FROM python:3.12.12-alpine3.22
ARG BUILD_VERSION
ARG BUILD_ARCH
LABEL io.hass.version=$BUILD_VERSION io.hass.type="app" io.hass.arch=$BUILD_ARCH
RUN pip install --no-cache-dir aiohttp==3.13.3
WORKDIR /app
COPY receiver.py /app/receiver.py
COPY diagnostics.py /app/diagnostics.py
CMD ["python", "-u", "/app/receiver.py"]
