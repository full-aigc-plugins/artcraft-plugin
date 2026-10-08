/** Art 自有调用边界：保留领域文件原字节，在解码工具文本前拒绝歧义 JSON。 */
export const strictMcpRunner = String.raw`"""受信 Art 启动器，先校验实际工具 schema，再校验响应；不重试任何请求。"""
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

def tool_map(value):
    if not isinstance(value, dict) or not isinstance(value.get('tools'), list) or value.get('nextCursor'):
        raise ValueError('tools_list_invalid')
    result = {}
    for tool in value['tools']:
        if not isinstance(tool, dict) or not isinstance(tool.get('name'), str) or not tool['name']:
            raise ValueError('tool_invalid')
        schema = tool.get('inputSchema')
        if tool['name'] in result or not isinstance(schema, dict) or schema.get('type') != 'object':
            raise ValueError('tool_schema_invalid')
        result[tool['name']] = json.dumps(schema, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return result

try:
    snapshot = expected.parent.parent / 'references' / 'native-command-snapshot.json'
    locked_tools = tool_map(json.loads(snapshot.read_text(encoding='utf-8'), parse_constant=constant,
                                      parse_float=finite_float, object_pairs_hook=pairs))
    if not locked_tools:
        raise ValueError('empty_snapshot')
except (OSError, ValueError, TypeError, RecursionError):
    raise RuntimeError('capability_missing: native_tool_schema snapshot invalid') from None

def guarded_spec(name, location, *args, **kwargs):
    spec = original_spec(name, location, *args, **kwargs)
    if Path(location).resolve() == expected:
        original_execute = spec.loader.exec_module
        def execute(module):
            original_execute(module)
            original_session = module.Session
            class StrictSession(original_session):
                def verify_tools(self, result):
                    try:
                        actual = tool_map(result)
                        if any(actual.get(name) != schema for name, schema in locked_tools.items()):
                            raise ValueError('schema_drift')
                    except (ValueError, TypeError, RecursionError):
                        self._schema_refused = True
                        raise RuntimeError('capability_missing: native_tool_schema mismatch') from None
                    self._schema_verified = True

                def request(self, method, params):
                    if method in ('tools/list', 'tools/call') and getattr(self, '_schema_refused', False):
                        raise RuntimeError('capability_missing: native_tool_schema previously refused')
                    if method == 'tools/call':
                        if not getattr(self, '_schema_verified', False):
                            self.verify_tools(super().request('tools/list', {}))
                        if not isinstance(params, dict) or params.get('name') not in locked_tools:
                            self._schema_refused = True
                            raise RuntimeError('capability_missing: native_tool_schema unlocked tool')
                    result = super().request(method, params)
                    if method == 'tools/list':
                        self.verify_tools(result)
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
