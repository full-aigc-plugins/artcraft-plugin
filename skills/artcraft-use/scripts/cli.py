#!/usr/bin/env python3
"""本项目 ArtCraft 编排 CLI 的公开 Python 启动器；不是上游 Tauri 应用 CLI。"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode=True
ALLOWED={'--version','--help','run','status','cancel','package','verify-package'}
def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--runtime-home',type=Path,default=Path(os.environ.get('CRAFT_RUNTIME_HOME',str(Path.home()/'.local/share/craft-runtimes'))))
 parser.add_argument('--node-archive',type=Path,default=os.environ.get('CRAFT_NODE_ARCHIVE'));parser.add_argument('--bundle-dir',type=Path,default=os.environ.get('CRAFT_BUNDLE_DIRECTORY'));parser.add_argument('--native-archive-dir',type=Path,default=os.environ.get('CRAFT_NATIVE_ARCHIVE_DIRECTORY'))
 parser.add_argument('arguments',nargs=argparse.REMAINDER);args=parser.parse_args();argv=args.arguments
 if argv[:1]==['--']:argv=argv[1:]
 if not argv or argv[0] not in ALLOWED:parser.error('unsupported_cli_subcommand')
 command=[sys.executable,'-I','-B',str(Path(__file__).with_name('bootstrap.py')),'--runtime-home',str(args.runtime_home)]
 for flag,value in [('--node-archive',args.node_archive),('--bundle-dir',args.bundle_dir),('--native-archive-dir',args.native_archive_dir)]:
  if value is not None:command.extend([flag,str(value)])
 try:
  setup=subprocess.run(command,capture_output=True,text=True,timeout=600)
  if setup.returncode:print(setup.stdout);return setup.returncode
  installed=json.loads(setup.stdout)
  return subprocess.run([installed['nodeExecutable'],installed['entryPoint'],*argv],timeout=600).returncode
 except (ValueError,OSError,subprocess.SubprocessError) as error:
  print(json.dumps({'error':str(error),'result':'unknown' if isinstance(error,subprocess.TimeoutExpired) else 'failed'}));return 1
if __name__=='__main__':raise SystemExit(main())
