/** Art 自有调用边界：保留领域文件原字节，在解码工具文本前拒绝歧义 JSON。 */
export const strictMcpRunner = String.raw`"""受信 Art 启动器，仅校验响应，不重试任何请求。"""
import importlib.util
import json
import math
from pathlib import Path
import runpy
import sys

module_path, script, *arguments = sys.argv[1:]
expected = Path(module_path).resolve()
original_spec = importlib.util.spec_from_file_location

def constant(value):
    raise ValueError('nonfinite')

def finite_float(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError('overflow')
    return result

def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('duplicate_json_key')
        result[key] = value
    return result

def guarded_spec(name, location, *args, **kwargs):
    spec = original_spec(name, location, *args, **kwargs)
    if Path(location).resolve() == expected:
        original_execute = spec.loader.exec_module
        def execute(module):
            original_execute(module)
            original_session = module.Session
            class StrictSession(original_session):
                def request(self, method, params):
                    result = super().request(method, params)
                    if method == 'tools/call' and not result.get('isError', False):
                        try:
                            for entry in result.get('content', []):
                                if entry.get('type') == 'text':
                                    json.loads(entry['text'], parse_constant=constant,
                                               parse_float=finite_float, object_pairs_hook=pairs)
                        except (ValueError, OverflowError, TypeError, RecursionError):
                            raise RuntimeError('outcome_unknown: invalid_tool_content_json; request not retried') from None
                    return result
            module.Session = StrictSession
        spec.loader.exec_module = execute
    return spec

importlib.util.spec_from_file_location = guarded_spec
sys.argv = [script, *arguments]
runpy.run_path(script, run_name='__main__')
`;
