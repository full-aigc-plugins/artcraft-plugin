"""测试代理：转发原生请求，仅在真正保存成功后替换回复。"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import threading

fault, log, capture = sys.argv[1:4]
process = subprocess.Popen(sys.argv[4:], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                           stderr=subprocess.DEVNULL, text=True, bufsize=1)
saved = {}
def forward():
    try:
        for line in sys.stdin:
            request = json.loads(line)
            params = request.get('params', {})
            arguments = params.get('arguments', {})
            if request.get('method') == 'tools/call' and arguments.get('command') == 'document.save':
                saved[request['id']] = arguments['params']['path']
            process.stdin.write(line)
            process.stdin.flush()
    finally:
        process.stdin.close()
threading.Thread(target=forward, daemon=True).start()
try:
    for line in process.stdout:
        reply = json.loads(line)
        if reply.get('id') not in saved:
            print(line, end='', flush=True)
            continue
        result = reply.get('result')
        if not isinstance(result, dict) or result.get('isError'):
            raise RuntimeError('native_save_did_not_succeed')
        path = Path(saved[reply['id']])
        shutil.copyfile(path, capture)
        with Path(log).open('a') as output:
            output.write(json.dumps({'saveSucceeded': True, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})+'\n')
        if fault == 'malformed':
            print('not-json', flush=True)
        elif fault == 'scalar':
            print('[]', flush=True)
        elif fault == 'missing':
            print(json.dumps({'id': reply['id']}), flush=True)
        elif fault == 'ambiguous':
            reply['error'] = {'code': -32603, 'message': 'injected conflict'}
            print(json.dumps(reply), flush=True)
        elif fault == 'nonfinite':
            reply['result'] = float('nan')
            print(json.dumps(reply), flush=True)
        else:
            reply['result'] = {'content': [None]}
            print(json.dumps(reply), flush=True)
finally:
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
