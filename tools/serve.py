"""테스트용 서버: 게임 폴더를 http://localhost:8000 으로 띄웁니다 (캐시 없이 항상 새 파일).

    python3 tools/serve.py          # 기본 8000번
    python3 tools/serve.py 8080     # 다른 번호

게임에는 필요 없는 개발용 기능: 브라우저에서 POST /shot (본문 = PNG data URL)을 보내면
.claude/shots/ 폴더에 스크린샷으로 저장합니다.
"""
import base64
import http.server
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, '.claude', 'shots')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path != '/shot':
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = base64.b64decode(body.split(',', 1)[-1])
        os.makedirs(SHOTS, exist_ok=True)
        name = time.strftime('%Y%m%d-%H%M%S') + '.png'
        with open(os.path.join(SHOTS, name), 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(name.encode())

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'http://localhost:{port}  (Ctrl+C로 끝내기)')
    http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
