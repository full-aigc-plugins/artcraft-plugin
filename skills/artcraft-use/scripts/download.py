"""只读制品下载的有界恢复；调用方继续检查锁定摘要。"""
import http.client
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.request

def download(url, destination, limit, size_error):
 """临时网络失败最多三次，绝不复用半包或重试原生写操作。"""
 destination=Path(destination)
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=60) as response,destination.open('wb') as output:
    count=0
    while block:=response.read(1024*1024):
     count+=len(block)
     if count>limit:raise ValueError(size_error)
     output.write(block)
    declared=response.headers.get('Content-Length')
    if declared is not None and declared.isdigit() and count!=int(declared):raise http.client.IncompleteRead(b'',int(declared)-count)
   return
  except (urllib.error.URLError,TimeoutError,ConnectionError,ssl.SSLEOFError,http.client.IncompleteRead) as error:
   if destination.exists():destination.unlink()
   if isinstance(error,urllib.error.HTTPError) and error.code not in (408,429) and not 500<=error.code<=599:raise
   if isinstance(error,urllib.error.URLError) and isinstance(error.reason,ssl.SSLCertVerificationError):raise
   if attempt==2:raise ValueError('artifact_download_failed: three read-only attempts exhausted') from error
   time.sleep(attempt+1)
