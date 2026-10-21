const ORIGIN = "https://yamadayoshitaka.github.io";
const MODEL = "gemini-2.5-flash";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const send = (body, status=200) => new Response(JSON.stringify(body),{status,headers:cors});
const str = (value,max=500) => typeof value==="string" ? value.slice(0,max).trim() : "";
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
    if(request.method==="GET" && (url.pathname==="/"||url.pathname==="/api/status")) {
      return send({status:"ok",game:"灰銀のレゾナンス",ai:!!(env.GEMINI_API_KEY||env.GOOGLE_API_KEY),message:"Worker稼働中（会話未確認）"});
    }
    if(url.pathname!=="/api/chat") return send({error:"Not Found"},404);
    if(request.method!=="POST") return send({error:"POSTを使用してください"},405);
    if(request.headers.get("Origin") && request.headers.get("Origin")!==ORIGIN) return send({error:"Origin not allowed"},403);
    const apiKey=env.GEMINI_API_KEY||env.GOOGLE_API_KEY;
    if(!apiKey) return send({error:"GEMINI_API_KEY または GOOGLE_API_KEY シークレットが未設定です"},503);
    let input;
    try{input=await request.json()}catch{return send({error:"JSON形式が不正です"},400)}
    const message=str(input?.message,240);
    if(!message) return send({error:"質問が空です"},400);
    const npcName=str(input?.npcName,60)||"町の住人";
    const memory=Array.isArray(input?.memory)?input.memory.slice(-8):[];
    const history=memory.map(m=>`旅人: ${str(m?.q,240)}\n${npcName}: ${str(m?.reply,400)}`).join("\n");
    const instruction=`あなたはファンタジーRPG「灰銀のレゾナンス」の町「レヴナ」に暮らすNPC「${npcName}」です。住人として自然な日本語で1〜3文で答えてください。噴水、市場、水晶街道、北の遺跡がある世界です。過去の会話を覚えて人格と口調を保ってください。\n過去の会話:\n${history}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
        method:"POST",
        headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
        body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:"user",parts:[{text:message}]}],generationConfig:{maxOutputTokens:512,temperature:0.8}}),
        signal:controller.signal
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) return send({error:`Gemini HTTP ${res.status}: ${str(data?.error?.message,300)||"APIエラー"}`},res.status>=500?502:res.status);
      const reply=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
      if(!reply)return send({error:"Geminiの応答が空です"},502);
      return send({reply});
    }catch(e){
      return send({error:e?.name==="AbortError"?"Gemini APIがタイムアウトしました":"Gemini API通信に失敗しました"},502);
    }finally{clearTimeout(timer)}
  }
};
