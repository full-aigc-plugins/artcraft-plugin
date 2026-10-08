"""仅测试：在真实Art子安装进程中注入两次半包，第三次使用真实公开HTTPS。"""
import http.client
import json
from pathlib import Path
import runpy
import ssl
import subprocess
import sys
import urllib.request

phase, script, log_path, domain, *arguments = sys.argv[1:]
log = Path(log_path)


def record(value):
    with log.open('a') as stream:
        stream.write(json.dumps(value)+'\n')


if phase == 'art':
    original_run = subprocess.run

    def injected_run(args, *positional, **keywords):
        argv = list(map(str, args))
        if len(argv) > 3 and Path(argv[3]).name == 'bootstrap.py' and '/'+domain+'-use/' in argv[3]:
            record({'event': 'child-public-bootstrap', 'script': argv[3]})
            argv = [*argv[:3], str(Path(__file__).resolve()), 'native', argv[3], str(log), domain, *argv[4:]]
        elif argv and Path(argv[0]).name == domain+'-cli':
            record({'event': 'native-command', 'args': argv[1:]})
        return original_run(argv, *positional, **keywords)

    subprocess.run = injected_run
elif phase == 'native':
    real_open = urllib.request.urlopen
    native_run = subprocess.run
    home = Path(arguments[arguments.index('--runtime-home')+1])
    count = 0

    class PartialSource:
        def __init__(self, url, attempt):
            self.url = url; self.attempt = attempt; self.reads = 0
            self.headers = {'Content-Length': '999'}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, size):
            self.reads += 1
            if self.reads == 1:
                return b'controlled-partial-native-archive'
            if self.attempt == 1:
                raise ssl.SSLEOFError('controlled first partial SSL EOF')
            return b''

    def injected_open(request, *args, **kwargs):
        global count
        count += 1
        partials = [str(p) for p in (home/domain).glob('.install-*/release.zip') if p.exists()]
        if partials:
            raise AssertionError('previous_partial_archive_not_discarded')
        record({'event': 'native-download', 'attempt': count, 'fault': 'partial-ssl-eof' if count == 1 else 'incomplete-content-length' if count == 2 else 'real-public-https', 'priorPartialAbsent': True, 'url': request.full_url})
        if count <= 2:
            return PartialSource(request.full_url, count)
        return real_open(request, *args, **kwargs)

    def native_version_only(args, *positional, **keywords):
        argv = list(map(str, args))
        if argv and Path(argv[0]).name == domain+'-cli':
            record({'event': 'native-command', 'args': argv[1:]})
            if argv[1:] != ['--version']:
                raise AssertionError('native_edit_or_render_not_allowed_in_download_test')
        return native_run(args, *positional, **keywords)

    urllib.request.urlopen = injected_open
    subprocess.run = native_version_only
else:
    raise ValueError('fixture_phase_invalid')

sys.argv = [script, *arguments]
runpy.run_path(script, run_name='__main__')
