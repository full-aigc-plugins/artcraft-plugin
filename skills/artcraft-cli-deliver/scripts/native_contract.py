"""受信 Art 启动器，先校验实际工具 schema，再校验响应；不重试任何请求。"""
import importlib.util
import json
import math
from pathlib import Path
import runpy
import sys

module_path, script, *arguments = sys.argv[1:]
expected = Path(module_path).resolve()
original_spec = importlib.util.spec_from_file_location

# 模式来自受信启动参数；桌面入口沿用其自有会话和停止管理。
mode = 'desktop' if Path(script).name == 'desktop.py' else 'headless'
if '--mode' in arguments:
    position = arguments.index('--mode')
    if mode == 'desktop' or arguments.count('--mode') != 1 or position + 1 >= len(arguments):
        raise RuntimeError('capability_missing: native_tool_schema invalid mode')
    mode = arguments[position + 1]
if mode not in ('headless', 'bridge', 'desktop'):
    raise RuntimeError('capability_missing: native_tool_schema invalid mode')

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

def command_map(value):
    if isinstance(value, dict):
        commands = value.get('commands')
        if not isinstance(commands, list) or type(value.get('count')) is not int or value['count'] != len(commands) or value.get('nextCursor'):
            raise ValueError('command_catalog_invalid')
        value = commands
    if not isinstance(value, list):
        raise ValueError('command_catalog_invalid')
    result = {}
    for command in value:
        if not isinstance(command, dict) or not isinstance(command.get('id'), str) or not command['id'] or command['id'] in result:
            raise ValueError('command_id_invalid')
        present = 'params' in command
        if present and not isinstance(command['params'], str):
            raise ValueError('command_params_invalid')
        result[command['id']] = (present, command.get('params'))
    return result

try:
    snapshot = expected.parent.parent / 'references' / 'native-command-snapshot.json'
    snapshot_value = json.loads(snapshot.read_text(encoding='utf-8'), parse_constant=constant,
                                parse_float=finite_float, object_pairs_hook=pairs)
    locked_tools = tool_map(snapshot_value)
    if not locked_tools:
        raise ValueError('empty_snapshot')
    if mode in ('bridge', 'desktop') and snapshot_value.get('pluginId') == 'effectcraft':
        bridge = json.loads((snapshot.parent / 'bridge-tools.json').read_text(encoding='utf-8'),
                            parse_constant=constant, parse_float=finite_float, object_pairs_hook=pairs)
        desktop = json.loads((expected.parent / 'desktop.lock.json').read_text(encoding='utf-8'),
                             parse_constant=constant, parse_float=finite_float, object_pairs_hook=pairs)
        if (not isinstance(bridge, dict) or not isinstance(desktop, dict)
                or bridge.get('schema') != 'craft-bridge-tools/v1' or bridge.get('pluginId') != 'effectcraft'
                or bridge.get('mode') != 'bridge' or bridge.get('runtimeSha256') != snapshot_value.get('runtimeSha256')
                or not isinstance(bridge.get('runtimeSha256'), str) or len(bridge['runtimeSha256']) != 64
                or any(c not in '0123456789abcdef' for c in bridge['runtimeSha256'])
                or not isinstance(bridge.get('desktopBinarySha256'), str) or len(bridge['desktopBinarySha256']) != 64
                or any(c not in '0123456789abcdef' for c in bridge['desktopBinarySha256'])
                or bridge['desktopBinarySha256'] != desktop.get('binarySha256')):
            raise ValueError('bridge_snapshot_identity')
        additional = tool_map(bridge)
        if not additional or set(additional) & set(locked_tools):
            raise ValueError('bridge_snapshot_tool_collision')
        locked_tools.update(additional)
except (OSError, ValueError, TypeError, RecursionError):
    raise RuntimeError('capability_missing: native_tool_schema snapshot invalid') from None

try:
    catalog_tool = {'effectcraft': 'list_commands', 'filmcraft': 'command_list',
                    'photocraft': 'command_list', 'vectorcraft': 'list_commands'}[snapshot_value['pluginId']]
    locked_commands = command_map(snapshot_value['commands'])
    if not locked_commands or catalog_tool not in locked_tools:
        raise ValueError('command_snapshot_invalid')
except (KeyError, ValueError, TypeError, RecursionError):
    raise RuntimeError('capability_missing: native_command_schema snapshot invalid') from None

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

                def verify_commands(self, result):
                    try:
                        if not isinstance(result, dict) or result.get('isError', False) is not False:
                            raise ValueError('command_query_failed')
                        content = result.get('content')
                        if not isinstance(content, list) or len(content) != 1 or not isinstance(content[0], dict) or content[0].get('type') != 'text':
                            raise ValueError('command_query_content_invalid')
                        value = json.loads(content[0]['text'], parse_constant=constant,
                                           parse_float=finite_float, object_pairs_hook=pairs)
                        if command_map(value) != locked_commands:
                            raise ValueError('command_schema_drift')
                    except (KeyError, ValueError, TypeError, RecursionError):
                        self._command_refused = True
                        raise RuntimeError('capability_missing: native_command_schema mismatch') from None
                    self._commands_verified = True

                def query_commands(self, params):
                    try:
                        result = super().request('tools/call', params)
                    except Exception:
                        self._command_refused = True
                        raise RuntimeError('capability_missing: native_command_schema readonly query failed; request not retried') from None
                    self.verify_commands(result)
                    return result

                def request(self, method, params):
                    if method in ('tools/list', 'tools/call') and getattr(self, '_command_refused', False):
                        raise RuntimeError('capability_missing: native_command_schema previously refused')
                    if method in ('tools/list', 'tools/call') and getattr(self, '_schema_refused', False):
                        raise RuntimeError('capability_missing: native_tool_schema previously refused')
                    if method == 'tools/call':
                        if not getattr(self, '_schema_verified', False):
                            self.verify_tools(super().request('tools/list', {}))
                        if not isinstance(params, dict) or params.get('name') not in locked_tools:
                            self._schema_refused = True
                            raise RuntimeError('capability_missing: native_tool_schema unlocked tool')
                    full_catalog_query = method == 'tools/call' and params.get('name') == catalog_tool and params.get('arguments', {}) == {}
                    if full_catalog_query:
                        result = self.query_commands(params)
                    else:
                        if method == 'tools/call' and (not getattr(self, '_commands_verified', False) or params.get('name') == catalog_tool):
                            self.query_commands({'name': catalog_tool, 'arguments': {}})
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
