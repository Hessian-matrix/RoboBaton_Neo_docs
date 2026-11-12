"""Neo desktop read-only connector. Python standard library; packaged on Windows."""
import argparse
import http.client
import ipaddress
import json
import socket
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "1.0.0"
PORT = 18765
ORIGIN = "https://hessian-matrix.github.io"
CHANNELS = {"odometry", "gray_jpeg"}
PRIVATE = tuple(ipaddress.ip_network(x) for x in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))

def target(value):
    u = urllib.parse.urlsplit(value)
    ip = ipaddress.IPv4Address(u.hostname or "")
    if (u.scheme != "http" or u.username is not None or u.password is not None or
            u.path not in ("", "/") or u.query or u.fragment or
            not any(ip in network for network in PRIVATE)):
        raise ValueError("Only a private IPv4 HTTP device address is supported")
    port = u.port or 80
    if not 1 <= port <= 65535:
        raise ValueError("Invalid device port")
    return str(ip), port

class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False
    def __init__(self, port=PORT, origin=ORIGIN):
        self.allowed_origin = origin
        self.slots = threading.BoundedSemaphore(2)
        self.stop_event = threading.Event()
        super().__init__(("127.0.0.1", port), Handler)

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "NeoConnect/" + VERSION
    sys_version = ""
    def setup(self):
        super().setup()
        self.connection.settimeout(5)
    def log_message(self, *args):
        pass
    def permitted(self):
        hosts = self.headers.get_all("Host", [])
        origins = self.headers.get_all("Origin", [])
        return (hosts == ["127.0.0.1:" + str(self.server.server_port)] and
                (not origins or origins == [self.server.allowed_origin]))
    def cors(self):
        if self.headers.get_all("Origin", []) == [self.server.allowed_origin]:
            self.send_header("Access-Control-Allow-Origin", self.server.allowed_origin)
            self.send_header("Vary", "Origin")
    def reply(self, status, code, **data):
        body = json.dumps(dict(code=code, **data), ensure_ascii=False).encode()
        self.send_response(status)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        self.wfile.write(body)
    def do_OPTIONS(self):
        if not self.permitted():
            return self.reply(403, "ORIGIN_DENIED")
        route = urllib.parse.urlsplit(self.path).path
        if route not in ("/health", "/api/stream"):
            return self.reply(404, "NOT_FOUND")
        methods = self.headers.get_all("Access-Control-Request-Method", [])
        if methods != ["GET"]:
            return self.reply(405, "READ_ONLY")
        requested = self.headers.get_all("Access-Control-Request-Headers", [])
        if len(requested) > 1 or (requested and any(x.strip().lower() not in ("content-type", "cache-control") for x in requested[0].split(","))):
            return self.reply(400, "HEADERS_DENIED")
        self.send_response(204)
        self.cors()
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Cache-Control")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
    def do_GET(self):
        if not self.permitted():
            return self.reply(403, "ORIGIN_DENIED")
        if self.headers.get("Content-Length") or self.headers.get("Transfer-Encoding"):
            return self.reply(400, "BODY_NOT_ALLOWED")
        route = urllib.parse.urlsplit(self.path)
        if route.path == "/health" and not route.query:
            return self.reply(200, "READY", product="neo-connect", version=VERSION, channels=sorted(CHANNELS))
        if route.path != "/api/stream":
            return self.reply(404, "NOT_FOUND")
        query = urllib.parse.parse_qs(route.query, keep_blank_values=True)
        try:
            if set(query) != {"device", "channels"} or any(len(v) != 1 for v in query.values()):
                raise ValueError()
            channel = query["channels"][0]
            if channel not in CHANNELS:
                raise ValueError()
            host, port = target(query["device"][0])
        except (ValueError, KeyError):
            return self.reply(400, "INVALID_DEVICE_OR_CHANNEL")
        if not self.server.slots.acquire(blocking=False):
            return self.reply(429, "CONNECTOR_BUSY")
        upstream = http.client.HTTPConnection(host, port, timeout=5)
        started = False
        try:
            # No user headers, credentials, redirects, control commands or proxy
            # environment variables reach the device. HTTPResponse de-chunks RBH1.
            upstream.request("GET", "/api/stream?channels=" + channel, headers={"Connection": "close"})
            response = upstream.getresponse()
            if response.status != 200:
                return self.reply(502, "DEVICE_HTTP_ERROR", device_status=response.status)
            if response.getheader("Content-Type", "").split(";")[0].strip() != "application/vnd.robobaton.stream":
                return self.reply(502, "DEVICE_PROTOCOL_MISMATCH")
            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "application/vnd.robobaton.stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            started = True
            deadline = time.monotonic() + 65
            while not self.server.stop_event.is_set() and time.monotonic() < deadline:
                chunk = response.read1(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (OSError, http.client.HTTPException):
            if not started:
                self.reply(502, "DEVICE_UNREACHABLE")
        finally:
            upstream.close()
            self.server.slots.release()
    def do_POST(self):
        self.reply(405, "READ_ONLY")
    do_PUT = do_DELETE = do_PATCH = do_POST

def main():
    parser = argparse.ArgumentParser(description="Neo read-only desktop connector")
    parser.add_argument("--headless", action="store_true", help="Run without the desktop window")
    args = parser.parse_args()
    try:
        server = Server()
    except OSError:
        if args.headless:
            raise SystemExit("127.0.0.1:18765 is already in use")
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk(); root.withdraw()
        messagebox.showerror("Neo 连接工具", "无法启动：18765 端口已被占用。请检查连接工具是否已经打开。")
        root.destroy()
        return
    if args.headless:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.stop_event.set(); server.server_close()
        return
    import tkinter as tk
    from tkinter import ttk
    import webbrowser
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    root = tk.Tk(); root.title("Neo 连接工具"); root.geometry("460x260"); root.minsize(420, 240)
    frame = ttk.Frame(root, padding=26); frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="Neo · 连接工具已就绪", font=("Microsoft YaHei UI", 17, "bold")).pack(anchor="w", pady=(0, 16))
    ttk.Label(frame, text="1. 通过 USB 连接 Neo。\n2. 打开网页，填写设备地址。\n3. 点击连接并运行，允许浏览器访问本地网络。", font=("Microsoft YaHei UI", 10)).pack(anchor="w")
    ttk.Button(frame, text="打开网页验证", command=lambda: webbrowser.open(ORIGIN + "/RoboBaton_Neo_docs/integration.html?language=python")).pack(anchor="w", pady=18)
    ttk.Label(frame, text="仅接收位姿与图像 · 关闭窗口即停止 · v" + VERSION).pack(anchor="w")
    def close():
        server.stop_event.set(); server.shutdown(); server.server_close(); root.destroy()
    root.protocol("WM_DELETE_WINDOW", close)
    root.mainloop()

if __name__ == "__main__":
    main()
