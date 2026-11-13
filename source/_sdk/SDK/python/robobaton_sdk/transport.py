"""Public HTTP connection and bounded RBH1 framing; no device control APIs."""
import http.client
import struct
from urllib.parse import urlsplit

class Device:
    def __init__(self, address):
        self.url = urlsplit(address)
        if self.url.scheme not in ('http', 'https') or not self.url.hostname or self.url.username or self.url.password or self.url.path not in ('', '/') or self.url.query or self.url.fragment:
            raise ValueError('Use a plain HTTP(S) device origin')

    def connection(self, timeout=10):
        cls = http.client.HTTPSConnection if self.url.scheme == 'https' else http.client.HTTPConnection
        return cls(self.url.hostname, self.url.port, timeout=timeout)


def records(response, formats=(1, 2, 3, 4, 5, 6, 7)):
    """HTTP library removes chunk framing; RBH1 must still be reassembled."""
    messages, previous = {}, {}
    allocated = 0
    while True:
        header = response.read(40)
        if not header:
            if messages:
                raise ValueError('Truncated message')
            return
        if len(header) != 40:
            raise ValueError('Truncated header')
        magic, version, header_bytes, channel, fmt, flags, sequence, total, offset, size, reserved = struct.unpack('<4sHHHHIQIIII', header)
        if (magic, version, header_bytes, reserved) != (b'RBH1', 1, 40, 0):
            raise ValueError('Invalid RBH1 header')
        if channel > 32 or fmt not in formats or not 0 < total <= 2*1024*1024+8208 or not 0 < size <= 65536 or offset+size > total or flags & ~3 or bool(flags & 1) != (offset == 0) or bool(flags & 2) != (offset+size == total) or (fmt == 1 and total > 128*1024):
            raise ValueError('Invalid RBH1 limits')
        if flags & 1:
            if channel in messages or sequence <= previous.get(channel, 0) or allocated+total > 16*1024*1024:
                raise ValueError('Duplicate message or memory limit')
            messages[channel] = [sequence, fmt, bytearray(total), 0]
            allocated += total
        message = messages.get(channel)
        if not message or message[0] != sequence or message[1] != fmt or len(message[2]) != total or message[3] != offset:
            raise ValueError('Discontinuous fragment')
        payload = response.read(size)
        if len(payload) != size:
            raise ValueError('Truncated fragment')
        message[2][offset:offset+size] = payload; message[3] += size
        if flags & 2:
            del messages[channel]; allocated -= total; previous[channel] = sequence
            yield channel, fmt, sequence, message[2]
