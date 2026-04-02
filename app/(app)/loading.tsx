export default function Loading() {
  return (
    <div style={{padding:24,background:'var(--surface-subtle)',flex:1}}>
      <div style={{height:28,width:180,borderRadius:8,background:'#e2e8f0',marginBottom:8,animation:'pulse 1.5s ease-in-out infinite'}}/>
      <div style={{height:16,width:280,borderRadius:6,background:'#f1f5f9',marginBottom:28,animation:'pulse 1.5s ease-in-out infinite'}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {[0,1,2].map(i=><div key={i} style={{height:88,borderRadius:10,background:'#fff',border:'1px solid #e2e8f0',animation:'pulse 1.5s ease-in-out infinite'}}/>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.1fr 0.9fr',gap:20}}>
        <div style={{height:320,borderRadius:10,background:'#fff',border:'1px solid #e2e8f0',animation:'pulse 1.5s ease-in-out infinite'}}/>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{height:200,borderRadius:10,background:'#fff',border:'1px solid #e2e8f0',animation:'pulse 1.5s ease-in-out infinite'}}/>
          <div style={{height:100,borderRadius:10,background:'#fff',border:'1px solid #e2e8f0',animation:'pulse 1.5s ease-in-out infinite'}}/>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
