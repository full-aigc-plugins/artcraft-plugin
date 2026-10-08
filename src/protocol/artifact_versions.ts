/** 核对同一逻辑命名空间内的素材身份，不使用路径或文件名代替不可变版本。 */
export function assertArtifactVersions(artifacts:Record<string,any>[]):void {
  const versions=new Map<string,string>();
  const remember=(reference:Record<string,any>):void=>{
    if(!reference || typeof reference.assetId!=='string' || typeof reference.version!=='string' || typeof reference.sha256!=='string')throw new Error('protocol_invalid: artifact version reference');
    const key=JSON.stringify([reference.assetId,reference.version]);
    if(versions.has(key) && versions.get(key)!==reference.sha256)throw new Error('artifact_version_conflict');
    versions.set(key,reference.sha256);
  };
  for(const artifact of artifacts){
    remember(artifact);
    for(const reference of [...(artifact.sourceRefs ?? []),...(artifact.renditions ?? []),...(artifact.evidenceRefs ?? []),...(artifact.dependencies ?? []).map((dependency:Record<string,any>)=>dependency.assetRef),artifact.nativeProjectRef,artifact.lossReportRef].filter(Boolean))remember(reference);
  }
}
