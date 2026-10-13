#!/usr/bin/env python3
"""本项目 ArtCraft 编排 CLI 的公开 Python 启动器；不是上游 Tauri 应用 CLI。"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode=True
ALLOWED={'--version','--help','run','status','upgrade','cancel','package','verify-package','register-video-factory'}
def setup_failure(runtime_home):
 """安装器缺失时也保留当前技能自身的恢复位置，不读取兄弟技能。"""
 return {'skill':'artcraft-cli-setup','bootstrapScript':str(Path(__file__).with_name('bootstrap.py').resolve()),'runtimeHome':str(Path(runtime_home).expanduser().absolute()),'automaticRetry':False}
def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--runtime-home',type=Path,default=Path(os.environ.get('CRAFT_RUNTIME_HOME',str(Path.home()/'.local/share/craft-runtimes'))))
 parser.add_argument('--node-archive',type=Path,default=os.environ.get('CRAFT_NODE_ARCHIVE'));parser.add_argument('--bundle-dir',type=Path,default=os.environ.get('CRAFT_BUNDLE_DIRECTORY'));parser.add_argument('--native-archive-dir',type=Path,default=os.environ.get('CRAFT_NATIVE_ARCHIVE_DIRECTORY'))
 parser.add_argument('arguments',nargs=argparse.REMAINDER);args=parser.parse_args();argv=args.arguments
 if argv[:1]==['--']:argv=argv[1:]
 if not argv or argv[0] not in ALLOWED:parser.error('unsupported_cli_subcommand')
 command=[sys.executable,'-I','-B',str(Path(__file__).with_name('bootstrap.py')),'--runtime-home',str(args.runtime_home),'--runtime-only']
 for flag,value in [('--node-archive',args.node_archive),('--bundle-dir',args.bundle_dir),('--native-archive-dir',args.native_archive_dir)]:
  if value is not None:command.extend([flag,str(value)])
 installation_completed=False
 try:
  setup=subprocess.run(command,capture_output=True,text=True,timeout=600)
  if setup.returncode:
   try:reply=json.loads(setup.stdout)
   except ValueError:reply={'error':setup.stdout.strip() or setup.stderr.strip() or 'bootstrap_failed'}
   if not isinstance(reply,dict):reply={'error':setup.stdout.strip() or setup.stderr.strip() or 'bootstrap_failed'}
   reply.setdefault('dependencySetup',setup_failure(args.runtime_home));reply.setdefault('result','failed')
   print(json.dumps(reply));return setup.returncode
  installed=json.loads(setup.stdout)
  installation_completed=True
  return subprocess.run([installed['nodeExecutable'],installed['entryPoint'],*argv],timeout=600).returncode
 except (ValueError,OSError,subprocess.SubprocessError) as error:
  reply={'error':str(error),'result':'unknown' if isinstance(error,subprocess.TimeoutExpired) else 'failed'}
  if not installation_completed:reply['dependencySetup']=setup_failure(args.runtime_home)
  print(json.dumps(reply));return 1
if __name__=='__main__':raise SystemExit(main())
