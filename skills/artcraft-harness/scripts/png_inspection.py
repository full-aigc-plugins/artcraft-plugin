"""标准静态 PNG 的有限资源结构与扫描数据核验；不证明视觉或色彩保真。"""
import struct
import zlib
SIGNATURE=b'\x89PNG\r\n\x1a\n'
MAX_FILE=64*1024*1024
MAX_SCAN=128*1024*1024
def inspect_png(path):
 if path.stat().st_size>MAX_FILE:raise ValueError('provided_png_too_large')
 with path.open('rb') as stream:data=stream.read(MAX_FILE+1)
 def bad():raise ValueError('provided_png_invalid')
 if len(data)>MAX_FILE or data[:8]!=SIGNATURE:bad()
 offset=8;header=None;palette=0;transparency=False;compressed=[];ended=False;closed_data=False
 while offset<len(data):
  if offset+12>len(data):bad()
  size=struct.unpack_from('>I',data,offset)[0];kind=data[offset+4:offset+8];end=offset+12+size
  if end>len(data) or not all(65<=c<=90 or 97<=c<=122 for c in kind) or kind[2]&32:bad()
  body=data[offset+8:end-4]
  if zlib.crc32(kind+body)!=struct.unpack_from('>I',data,end-4)[0]:bad()
  if header is None and kind!=b'IHDR':bad()
  if kind==b'IHDR':
   if header is not None or size!=13:bad()
   width,height,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',body)
   if not 0<width<2**31 or not 0<height<2**31 or depth not in {0:(1,2,4,8,16),2:(8,16),3:(1,2,4,8),4:(8,16),6:(8,16)}.get(color,()) or compression or filtering or interlace not in (0,1):bad()
   header=(width,height,depth,color,interlace)
  elif kind==b'PLTE':
   if palette or compressed or transparency or color in (0,4) or size==0 or size%3 or size>768 or (color==3 and size//3>2**depth):bad()
   palette=size//3
  elif kind==b'tRNS':
   if transparency or compressed or not ((color==0 and size==2) or (color==2 and size==6) or (color==3 and 0<size<=palette)):bad()
   if color in (0,2) and any(v>=2**depth for v in struct.unpack('>'+'H'*(size//2),body)):bad()
   transparency=True
  elif kind==b'IDAT':
   if closed_data or (color==3 and not palette):bad()
   compressed.append(body)
  elif kind==b'IEND':
   if size or not compressed or end!=len(data):bad()
   ended=True
  elif kind==b'acTL':raise ValueError('provided_png_animated_unsupported')
  elif not kind[0]&32:bad()
  if compressed and kind!=b'IDAT':closed_data=True
  offset=end
 if not ended:bad()
 channels={0:1,2:3,3:1,4:2,6:4}[color]
 passes=[(0,0,1,1)] if not interlace else [(0,0,8,8),(4,0,8,8),(0,4,4,8),(2,0,4,4),(0,2,2,4),(1,0,2,2),(0,1,1,2)]
 rows=[];expected=0
 for x,y,dx,dy in passes:
  w=max(0,(width-x+dx-1)//dx);h=max(0,(height-y+dy-1)//dy)
  if not w or not h:continue
  stride=(w*channels*depth+7)//8+1;expected+=stride*h;rows.append((stride,h))
  if expected>MAX_SCAN:raise ValueError('provided_png_too_large')
 try:
  decoder=zlib.decompressobj();scan=decoder.decompress(b''.join(compressed),expected+1)
 except zlib.error:bad()
 if len(scan)!=expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:bad()
 at=0
 for stride,count in rows:
  for _ in range(count):
   if scan[at]>4:bad()
   at+=stride
 return {'width':width,'height':height,'bitDepth':depth,'alpha':color in (4,6) or transparency}
