#!/usr/bin/env python3
"""独立技能的项目打包与验包入口；经锁定安装器调用公开 ArtCraft CLI。"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode = True


class InstallationFailure(ValueError):
    """保留场景入口的安装错误，恢复位置仅取当前技能自身。"""
    def __init__(self, message, runtime_home, receipt=None, unknown=False):
        super().__init__(message)
        home = runtime_home or os.environ.get('CRAFT_RUNTIME_HOME', str(Path.home()/'.local/share/craft-runtimes'))
        self.diagnostic = {'dependencySetup': {
            'skill': 'artcraft-cli-setup',
            'bootstrapScript': str(Path(__file__).with_name('bootstrap.py').resolve()),
            'runtimeHome': str(Path(home).expanduser().absolute()),
            'automaticRetry': False}, 'result': 'unknown' if unknown else 'failed'}
        if isinstance(receipt, dict):
            self.diagnostic['installationReceipt'] = receipt


def run_installation(command, runtime_home, prefix):
    """仅封装安装阶段；后续原生任务错误不进入依赖诊断。"""
    try:
        installed = subprocess.run(command, capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.SubprocessError) as error:
        raise InstallationFailure(str(error), runtime_home,
            unknown=isinstance(error, subprocess.TimeoutExpired)) from error
    if installed.returncode:
        message = installed.stdout.strip() or installed.stderr.strip() or 'bootstrap_failed'
        try:
            receipt = json.loads(installed.stdout)
        except ValueError:
            receipt = None
        raise InstallationFailure(prefix+message, runtime_home, receipt)
    try:
        receipt = json.loads(installed.stdout)
    except ValueError as error:
        raise InstallationFailure(str(error), runtime_home) from error
    if (not isinstance(receipt, dict) or receipt.get('schema') != 'artcraft-setup/v1'
            or any(not isinstance(receipt.get(field), str) or not receipt[field]
                   for field in ('nodeExecutable', 'entryPoint'))):
        raise InstallationFailure('setup_incomplete', runtime_home, receipt)
    return receipt



def execute(args):
    if args.action == 'create':
        if not args.project or not args.workflow or not args.output or not args.authorization:
            raise ValueError('package_arguments_required')
        project = args.project.expanduser().resolve(strict=True)
        marker = json.loads((project/'.artcraft-project.json').read_text())
        if marker.get('ownerId') != args.owner:
            raise ValueError('project_owner_mismatch')
        database = project/'tasks.sqlite'
        if not database.is_file():
            raise ValueError('project_ledger_missing')
        output = args.output.expanduser().resolve()
        if output.exists():
            raise ValueError('package_output_exists')
        command = ['package', '--database', str(database), '--workflow', args.workflow, '--owner', args.owner,
                   '--authorization', args.authorization, '--output', str(output)]
    else:
        if not args.package or not args.sha:
            raise ValueError('package_verification_arguments_required')
        command = ['verify-package', '--package', str(args.package.expanduser().resolve(strict=True)), '--sha', args.sha]
    setup_args = [sys.executable, '-I', '-B', str(Path(__file__).with_name('bootstrap.py')), '--runtime-home', str(args.runtime_home), '--runtime-only']
    for flag, value in [('--node-archive', args.node_archive), ('--bundle-dir', args.bundle_dir), ('--native-archive-dir', args.native_archive_dir)]:
        if value is not None:
            setup_args.extend([flag, str(value)])
    setup = run_installation(setup_args, args.runtime_home, 'package_setup_failed: ')
    result = subprocess.run([setup['nodeExecutable'], setup['entryPoint'], *command], capture_output=True, text=True, timeout=600)
    if not result.stdout.strip():
        raise RuntimeError('package_result_missing')
    receipt = json.loads(result.stdout)
    if result.returncode:
        raise RuntimeError(json.dumps(receipt, ensure_ascii=False))
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['create', 'verify'])
    parser.add_argument('--project', type=Path)
    parser.add_argument('--workflow')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--owner', default='local-user')
    parser.add_argument('--authorization')
    parser.add_argument('--package', type=Path)
    parser.add_argument('--sha')
    parser.add_argument('--runtime-home', type=Path, default=Path(os.environ.get('CRAFT_RUNTIME_HOME', str(Path.home()/'.local/share/craft-runtimes'))))
    parser.add_argument('--node-archive', type=Path)
    parser.add_argument('--bundle-dir', type=Path)
    parser.add_argument('--native-archive-dir', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(execute(args), ensure_ascii=False))
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError) as error:
        reply = {'error': str(error)}
        if isinstance(error, InstallationFailure):
            reply.update(error.diagnostic)
        print(json.dumps(reply, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
