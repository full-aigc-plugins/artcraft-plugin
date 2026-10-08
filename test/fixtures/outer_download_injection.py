"""仅测试：Node／核心／选定领域归档各两次故障后接续真实HTTPS。"""
import json
from pathlib import Path
import runpy
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

script, log_path, home_path, *arguments = sys.argv[1:]
log = Path(log_path); home = Path(home_path)
real_open = urllib.request.urlopen; real_run = subprocess.run
counts = {}


def record(value):
    with log.open('a') as stream:
        stream.write(json.dumps(value)+'\n')


class PartialSource:
    headers = {}
    def __init__(self): self.reads = 0
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self, size):
        self.reads += 1
        if self.reads == 1: return b'controlled-outer-partial-archive'
        raise ssl.SSLEOFError('controlled outer archive partial SSL EOF')


def injected_open(request, *args, **kwargs):
    url = request.full_url if isinstance(request, urllib.request.Request) else request
    counts[url] = counts.get(url, 0)+1; attempt = counts[url]
    if list(home.rglob('*.zip')) or list(home.rglob('*.tar.gz')):
        raise AssertionError('previous_outer_partial_archive_not_discarded')
    record({'event': 'outer-download', 'url': url, 'attempt': attempt, 'priorPartialAbsent': True, 'fault': 'partial-ssl-eof' if attempt == 1 else 'http503' if attempt == 2 else 'real-public-https'})
    if attempt == 1: return PartialSource()
    if attempt == 2: raise urllib.error.HTTPError(url, 503, 'controlled temporary unavailable', {}, None)
    return real_open(request, *args, **kwargs)


def injected_run(args, *positional, **keywords):
    argv = list(map(str, args))
    if argv and Path(argv[0]).name.endswith('craft-cli'):
        record({'event': 'native-command', 'args': argv[1:]})
        if argv[1:] != ['commands', '--json']:
            raise AssertionError('unexpected_native_edit_or_render')
    return real_run(argv, *positional, **keywords)


urllib.request.urlopen = injected_open
subprocess.run = injected_run
sys.argv = [script, '--runtime-home', home_path, *arguments]
runpy.run_path(script, run_name='__main__')
