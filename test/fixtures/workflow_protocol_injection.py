"""测试专用加载钩子；不修改、替换或放宽锁定的领域客户端。"""
import importlib.util
import contextlib
import io
from pathlib import Path
import runpy
import sys

proxy, fault, log, capture, reply_file, script, *arguments = sys.argv[1:]
original_spec = importlib.util.spec_from_file_location
def injected_spec(name, location, *args, **kwargs):
    spec = original_spec(name, location, *args, **kwargs)
    if Path(location).name == 'mcp_session.py':
        original_execute = spec.loader.exec_module
        def execute(module):
            original_execute(module)
            original_session = module.Session
            class InjectedSession(original_session):
                def __init__(self, argv, *args, **kwargs):
                    super().__init__([sys.executable, '-I', '-B', proxy, fault, log, capture, *argv], *args, **kwargs)
            module.Session = InjectedSession
        spec.loader.exec_module = execute
    return spec
importlib.util.spec_from_file_location = injected_spec
sys.argv = [script, *arguments]
output = io.StringIO()
try:
    with contextlib.redirect_stdout(output):
        runpy.run_path(script, run_name='__main__')
finally:
    text = output.getvalue()
    Path(reply_file).write_text(text)
    sys.stdout.write(text)
