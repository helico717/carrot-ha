"""Bounded whole-body reads; aiohttp StreamReader.read(n) may return only the first chunk."""


async def read_limited(response, limit):
    """Return the complete body, or None when it exceeds limit bytes."""
    body = bytearray()
    async for chunk in response.content.iter_chunked(65536):
        body += chunk
        if len(body) > limit:
            return None
    return bytes(body)
