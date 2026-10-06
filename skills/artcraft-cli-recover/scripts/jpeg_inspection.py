"""有界 JPEG 标记结构检查，不解码熵数据，不推断 EXIF／ICC 保真。"""
MAX_FILE=64*1024*1024
SOF={0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf}
def inspect_jpeg(path):
 def invalid():raise ValueError('provided_jpeg_invalid')
 def unsupported():raise ValueError('provided_jpeg_unsupported')
 with path.open('rb') as stream:data=stream.read(MAX_FILE+1)
 if len(data)>MAX_FILE:unsupported()
 if data[:2]!=b'\xff\xd8':invalid()
 position=2;facts=None;components=set();scans=0
 while position<len(data):
  if data[position]!=255:invalid()
  while position<len(data) and data[position]==255:position+=1
  if position>=len(data):invalid()
  marker=data[position];position+=1
  if marker==0xd9:
   if position!=len(data) or facts is None or not scans:invalid()
   return facts
  if marker in {0,1,0xd8} or 0xd0<=marker<=0xd7:invalid()
  if position+2>len(data):invalid()
  length=int.from_bytes(data[position:position+2],'big');end=position+length
  if length<2 or end>len(data):invalid()
  payload=data[position+2:end];position=end
  if marker in SOF:
   if marker not in {0xc0,0xc1,0xc2}:unsupported()
   if facts is not None or len(payload)<6:invalid()
   precision=payload[0];height=int.from_bytes(payload[1:3],'big');width=int.from_bytes(payload[3:5],'big');count=payload[5]
   if precision!=8:unsupported()
   if not width or not height or count not in {1,3,4} or len(payload)!=6+3*count:invalid()
   for index in range(count):
    identifier,sampling,table=payload[6+3*index:9+3*index]
    if identifier in components or not 1<=sampling>>4<=4 or not 1<=sampling&15<=4 or table>3:invalid()
    components.add(identifier)
   facts={'width':width,'height':height,'bitDepth':8,'alpha':False}
  elif marker==0xda:
   if facts is None or not payload:invalid()
   count=payload[0]
   if not 1<=count<=len(components) or len(payload)!=4+2*count:invalid()
   ids=set()
   for index in range(count):
    identifier,table=payload[1+2*index:3+2*index]
    if identifier not in components or identifier in ids or table>>4>3 or table&15>3:invalid()
    ids.add(identifier)
   scans+=1;entropy=False
   while position<len(data):
    if data[position]!=255:entropy=True;position+=1;continue
    start=position
    while position<len(data) and data[position]==255:position+=1
    if position>=len(data):invalid()
    following=data[position]
    if following==0 or 0xd0<=following<=0xd7:
     entropy=True;position+=1;continue
    position=start;break
   if not entropy:invalid()
  elif marker in {0xcc,0xdc,0xde,0xdf}:unsupported()
 invalid()
