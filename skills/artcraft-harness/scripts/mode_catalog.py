"""Art 自有模式目录；绑定不可变领域包及原生／桌面身份，缺失时拒绝回退。"""
import hashlib
import json
from pathlib import Path
CATALOG_SHA256='69aa578e1685996cea4fa5aa99260697a8c61d2273ad639e0885410baa07ce2c'
def load(root,domain,bundle):
 path=Path(root)/'references/mode-command-catalog.json'
 if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest()!=CATALOG_SHA256:raise ValueError('mode_catalog_identity')
 value=json.loads(path.read_text())
 if value.get('schema')!='artcraft-mode-command-catalog/v1' or value.get('platform')!='darwin-arm64' or value.get('modes')!=['bridge','desktop']:raise ValueError('mode_catalog_identity')
 row=value['domains'][domain];prefix='skills/'+domain+'-use/'
 if (row['sourceBundleSha256']!=bundle['sha256'] or row['snapshotSha256']!=bundle['files'][prefix+'references/native-command-snapshot.json'] or row['desktopLockSha256']!=bundle['files'][prefix+'scripts/desktop.lock.json']):raise ValueError('mode_catalog_identity')
 commands=row['commands']
 if not isinstance(commands,list) or not commands or any(not isinstance(r.get('id'),str) or not r['id'] or ('params' in r and not isinstance(r['params'],str)) for r in commands):raise ValueError('mode_catalog_invalid')
 return row
