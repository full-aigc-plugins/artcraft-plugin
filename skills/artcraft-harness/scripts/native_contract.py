"""受信 Art 启动器，先校验实际工具 schema，再校验响应；不重试任何请求。"""
import importlib.util
import hashlib
import json
import math
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
import runpy
import sys

module_path, script, *arguments = sys.argv[1:]
expected = Path(module_path).resolve()
original_spec = importlib.util.spec_from_file_location

# ART_NATIVE_BUDGET_BEGIN
class ArtNativeBudget:
    """仅为固定Film导出与完整解码分配剩余截止时间，不修改领域文件。"""
    def __init__(self, original, value):
        if (not isinstance(value, dict) or set(value) != {'executable', 'sha256', 'deadline'}
                or not isinstance(value['executable'], str)
                or not Path(value['executable']).is_absolute()
                or Path(value['executable']).name != 'filmcraft-cli'
                or not isinstance(value['sha256'], str) or len(value['sha256']) != 64
                or any(c not in '0123456789abcdef' for c in value['sha256'])
                or not isinstance(value['deadline'], str)):
            raise ValueError('native_call_budget_invalid')
        try:
            deadline = datetime.fromisoformat(value['deadline'].replace('Z', '+00:00'))
            if deadline.tzinfo is None or deadline.utcoffset().total_seconds() != 0:
                raise ValueError('deadline_utc_required')
            remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
            if not math.isfinite(remaining):
                raise ValueError('deadline_invalid')
        except (ValueError, OverflowError, TypeError):
            raise ValueError('native_call_budget_invalid') from None
        self.original = original
        self.executable = value['executable']
        self.sha256 = value['sha256']
        self.ends = time.monotonic() + remaining

    def __getattr__(self, name):
        return getattr(self.original, name)

    def run(self, command, **kwargs):
        verb = None
        if (isinstance(command, (list, tuple)) and command
                and command[0] == self.executable and all(isinstance(x, str) for x in command)):
            position = 1
            while position < len(command) and command[position] in ('--data-dir', '--project'):
                position += 2
            if position < len(command):
                verb = command[position]
        if verb in ('export', 'bench-decode'):
            native = Path(self.executable)
            digest = hashlib.sha256()
            if native.is_symlink() or not native.is_file() or kwargs.get('shell', False):
                raise ValueError('native_call_identity_mismatch')
            with native.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
            if digest.hexdigest() != self.sha256:
                raise ValueError('native_call_identity_mismatch')
            timeout = kwargs.get('timeout')
            if type(timeout) not in (int, float) or not math.isfinite(timeout) or not 0 < timeout <= 180:
                raise ValueError('native_call_budget_invalid')
            remaining = self.ends - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(command, 0)
            kwargs['timeout'] = min(3600, remaining)
        return self.original.run(command, **kwargs)
# ART_NATIVE_BUDGET_END

native_budgets = [a for a in arguments if a.startswith('--art-native-budget=')]
if len(native_budgets) > 1:
    raise ValueError('native_call_budget_invalid')
if native_budgets:
    arguments.remove(native_budgets[0])

# 模式来自受信启动参数；桌面入口沿用其自有会话和停止管理。
mode = 'desktop' if Path(script).name == 'desktop.py' else 'headless'
art_modes = [a for a in arguments if a.startswith('--art-mode=')]
if art_modes:
    if len(art_modes) != 1 or not arguments or arguments[0] != 'check':
        raise RuntimeError('capability_missing: native_tool_schema invalid mode')
    mode = art_modes[0].split('=', 1)[1]
    arguments.remove(art_modes[0])
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
    locked_catalog_rows = snapshot_value['commands']
    if mode in ('bridge', 'desktop'):
        resource = Path(__file__).resolve().parent.parent / 'references/mode-command-catalog.json'
        data = resource.read_bytes()
        if resource.is_symlink() or hashlib.sha256(data).hexdigest() != '69aa578e1685996cea4fa5aa99260697a8c61d2273ad639e0885410baa07ce2c':
            raise ValueError('mode_catalog_identity')
        modes = json.loads(data, parse_constant=constant, parse_float=finite_float, object_pairs_hook=pairs)
        row = modes['domains'][snapshot_value['pluginId']]
        desktop_file = expected.parent / 'desktop.lock.json'
        desktop = json.loads(desktop_file.read_bytes(), object_pairs_hook=pairs)
        if (modes.get('schema') != 'artcraft-mode-command-catalog/v1' or modes.get('platform') != 'darwin-arm64'
                or modes.get('modes') != ['bridge', 'desktop']
                or row['snapshotSha256'] != hashlib.sha256(snapshot.read_bytes()).hexdigest()
                or row['desktopLockSha256'] != hashlib.sha256(desktop_file.read_bytes()).hexdigest()
                or row['runtimeSha256'] != snapshot_value['runtimeSha256']
                or row['desktopBinarySha256'] != desktop['binarySha256']
                or row['desktopVersion'] != desktop['version']):
            raise ValueError('mode_catalog_identity')
        locked_catalog_rows = row['commands']
    locked_commands = command_map(locked_catalog_rows)
    if not locked_commands or catalog_tool not in locked_tools:
        raise ValueError('command_snapshot_invalid')
except (OSError, KeyError, ValueError, TypeError, RecursionError):
    raise RuntimeError('capability_missing: native_command_schema snapshot invalid') from None

def guarded_spec(name, location, *args, **kwargs):
    spec = original_spec(name, location, *args, **kwargs)
    if mode != 'headless' and Path(location).resolve() == expected.with_name('commands.py'):
        original_commands_execute = spec.loader.exec_module
        def execute_commands(module):
            original_commands_execute(module)
            original_catalog = module.catalog
            def mode_catalog():
                value = original_catalog()
                return {**value, 'commands': locked_catalog_rows}
            module.catalog = mode_catalog
        spec.loader.exec_module = execute_commands
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
if mode != 'headless' and Path(script).resolve() == expected.with_name('commands.py'):
    spec = guarded_spec('art_trusted_commands', script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    raise SystemExit(module.main())
if native_budgets:
    if (mode != 'headless' or snapshot_value.get('pluginId') != 'filmcraft'
            or Path(script).resolve() != expected.with_name('workflow.py')):
        raise ValueError('native_call_budget_invalid')
    budget = json.loads(native_budgets[0].split('=', 1)[1], parse_constant=constant,
                        parse_float=finite_float, object_pairs_hook=pairs)
    if not isinstance(budget, dict) or budget.get('sha256') != snapshot_value.get('runtimeSha256'):
        raise ValueError('native_call_identity_mismatch')
    spec = guarded_spec('art_trusted_film_workflow', script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.subprocess = ArtNativeBudget(module.subprocess, budget)
    raise SystemExit(module.main())
runpy.run_path(script, run_name='__main__')
