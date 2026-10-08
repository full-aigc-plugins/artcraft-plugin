"""保留当前单技能嵌套公开调用的结构化拒绝；不重放任务。"""
import json
from pathlib import Path
import subprocess


class PublicCallFailure(RuntimeError):
    """保留原公开回执；安装恢复位置仅由当前技能自身确定。"""
    def __init__(self, message, receipt, runtime_home, installation=False, unknown=False):
        super().__init__(message)
        self.diagnostic = {}
        if isinstance(receipt, dict):
            self.diagnostic['publicCallReceipt'] = receipt
        dependency = receipt.get('dependencySetup') if isinstance(receipt, dict) else None
        if installation or isinstance(dependency, dict):
            self.diagnostic['dependencySetup'] = {
                'skill': 'artcraft-cli-setup',
                'bootstrapScript': str(Path(__file__).with_name('bootstrap.py').resolve()),
                'runtimeHome': str(Path(runtime_home).expanduser().absolute()),
                'automaticRetry': False}
            unknown = unknown or (isinstance(receipt, dict) and receipt.get('result') == 'unknown')
            original = receipt.get('installationReceipt', receipt) if isinstance(receipt, dict) else None
            if isinstance(original, dict):
                self.diagnostic['installationReceipt'] = original
            self.diagnostic['result'] = 'unknown' if unknown else 'failed'
        elif unknown:
            self.diagnostic['result'] = 'unknown'


def run(command, prefix, runtime_home, parser=json.loads, installation=False, invalid='public_call_result_unknown'):
    """只调用一次，有界等待；非零结果不能通过返回 JSON 被误判为成功。"""
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.SubprocessError) as error:
        raise PublicCallFailure(str(error), None, runtime_home, installation,
            isinstance(error, subprocess.TimeoutExpired)) from error
    try:
        receipt = parser(result.stdout)
    except ValueError:
        receipt = None
    if result.returncode:
        message = result.stdout.strip() or result.stderr.strip() or 'public_call_failed'
        raise PublicCallFailure(prefix+message, receipt, runtime_home, installation)
    if not isinstance(receipt, dict):
        raise PublicCallFailure(invalid, receipt, runtime_home, installation)
    if installation and (receipt.get('schema') != 'artcraft-setup/v1'
            or not isinstance(receipt.get('skills'), dict)
            or any(not isinstance(receipt.get(field), str) or not receipt[field]
                   for field in ('nodeExecutable', 'entryPoint', 'runtimeHome'))):
        raise PublicCallFailure('setup_incomplete', receipt, runtime_home, installation=True)
    return receipt
