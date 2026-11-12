import http.client
import importlib.util
import json
from pathlib import Path
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("connector", Path(__file__).with_name("neo_connect.py"))
neo = importlib.util.module_from_spec(spec); spec.loader.exec_module(neo)

class Source(BaseHTTPRequestHandler):
    calls = []
    status = 200
    mime = "application/vnd.robobaton.stream"
    def log_message(self, *args): pass
    def do_GET(self):
        Source.calls.append((self.path, dict(self.headers)))
        self.send_response(Source.status)
        self.send_header("Content-Type", Source.mime)
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        self.wfile.write(b"4\r\nRBH1\r\n3\r\nabc\r\n0\r\n\r\n")

class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = ThreadingHTTPServer(("127.0.0.1", 0), Source)
        cls.server = neo.Server(0)
        for s in (cls.source, cls.server):
            threading.Thread(target=s.serve_forever, daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        for s in (cls.source, cls.server):
            s.shutdown(); s.server_close()
    def req(self, route="/health", method="GET", headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        c.request(method, route, headers=headers if headers is not None else {"Origin": neo.ORIGIN})
        r = c.getresponse(); result = r.status, dict(r.getheaders()), r.read(); c.close()
        return result
    def test_address_validation(self):
        for good in ("http://192.168.46.1", "http://192.168.11.1:46002", "http://10.1.2.3", "http://172.16.0.1"):
            self.assertIsInstance(neo.target(good), tuple)
        for bad in ("http://localhost", "http://127.0.0.1", "http://169.254.169.254", "http://8.8.8.8",
                    "http://192.168.46.1/x", "http://user@192.168.46.1", "http://192.168.46.1:65536",
                    "http://192.168.46.1?x=1", "http://[::1]", "https://192.168.46.1"):
            with self.subTest(bad=bad), self.assertRaises(ValueError): neo.target(bad)
    def test_health(self):
        status, h, body = self.req()
        self.assertEqual(status, 200); self.assertEqual(json.loads(body)["product"], "neo-connect")
        self.assertEqual(h["Access-Control-Allow-Origin"], neo.ORIGIN)
        self.assertNotIn("Access-Control-Allow-Credentials", h)
    def test_origin_and_host(self):
        for origin in ("null", "https://evil.example", neo.ORIGIN + ".evil", neo.ORIGIN + "/"):
            status, h, _ = self.req(headers={"Origin": origin})
            self.assertEqual(status, 403); self.assertNotIn("Access-Control-Allow-Origin", h)
        self.assertEqual(self.req(headers={"Host": "evil.example"})[0], 403)
        c = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        c.putrequest("GET", "/health"); c.putheader("Origin", neo.ORIGIN); c.putheader("Origin", neo.ORIGIN); c.endheaders()
        r = c.getresponse(); self.assertEqual(r.status, 403); r.read(); c.close()
    def test_preflight(self):
        h = {"Origin": neo.ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Private-Network": "true"}
        status, headers, _ = self.req(method="OPTIONS", headers=h)
        self.assertEqual(status, 204); self.assertEqual(headers["Access-Control-Allow-Private-Network"], "true")
        h["Access-Control-Request-Method"] = "POST"
        self.assertEqual(self.req(method="OPTIONS", headers=h)[0], 405)
        h["Access-Control-Request-Method"] = "GET"; h["Access-Control-Request-Headers"] = "authorization"
        self.assertEqual(self.req(method="OPTIONS", headers=h)[0], 400)
    def test_read_only(self):
        before = len(Source.calls)
        for method in ("POST", "PUT", "DELETE", "PATCH"):
            self.assertEqual(self.req("/api/vio", method)[0], 405)
        self.assertEqual(self.req("/api/vio")[0], 404)
        for path in ("/api/stream?device=http://192.168.46.1&channels=imu",
                     "/api/stream?device=http://192.168.46.1&channels=odometry&channels=gray_jpeg",
                     "/api/stream?device=http://127.0.0.1&channels=odometry"):
            self.assertEqual(self.req(path)[0], 400)
        self.assertEqual(len(Source.calls), before)
    def test_real_http_relay_and_errors(self):
        route = "/api/stream?device=http://192.168.46.1&channels=odometry"
        with patch.object(neo, "target", return_value=("127.0.0.1", self.source.server_port)):
            status, h, body = self.req(route)
            self.assertEqual(status, 200); self.assertEqual(body, b"RBH1abc")
            path, sent = Source.calls[-1]
            self.assertEqual(path, "/api/stream?channels=odometry"); self.assertNotIn("Origin", sent)
            self.assertNotIn("Cookie", sent); self.assertNotIn("Authorization", sent)
            try:
                Source.status = 302
                status, _, body = self.req(route)
                self.assertEqual(status, 502); self.assertEqual(json.loads(body)["device_status"], 302)
                Source.status = 200; Source.mime = "text/html"
                self.assertEqual(json.loads(self.req(route)[2])["code"], "DEVICE_PROTOCOL_MISMATCH")
                Source.mime = "application/vnd.robobaton.stream"
                self.server.slots.acquire(); self.server.slots.acquire()
                try: self.assertEqual(self.req(route)[0], 429)
                finally: self.server.slots.release(); self.server.slots.release()
            finally:
                Source.status = 200; Source.mime = "application/vnd.robobaton.stream"

if __name__ == "__main__": unittest.main()
