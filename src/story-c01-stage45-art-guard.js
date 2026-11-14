/**
 * Chapter 1 stages 4 & 5: one immutable, per-shot instruction packet for image
 * generators. This is a PROMPT CONTRACT, never an assertion that art exists.
 * It deliberately forbids the observed manga/bubble/UI style regression.
 */
export const STAGE45_IDS=Object.freeze(['c01-s04','c01-s05']);
const isText=s=>typeof s==='string'&&s.trim().length>0;
export function buildStage45ArtPrompt({stageId,stageName,edition,gender,shot,actorRefs,stageStory,styleRef}){
 if(!STAGE45_IDS.includes(stageId)||!isText(stageName)||!isText(stageStory)||
 !['male','female'].includes(gender)||!['pre','post-victory','post-defeat','post-gameover'].includes(edition)||
 !shot||typeof shot.id!=='string'||!shot.id.startsWith(stageId+'-')||
 !isText(shot.subtitleText||shot.text)||!Array.isArray(actorRefs)||actorRefs.length>4)
  throw Error('P0 rejected: incomplete stage 4/5 shot manifest');
 if(!styleRef||!isText(styleRef.path)||styleRef.gender!==gender||
 !styleRef.path.includes('-'+gender+'.webp'))
  throw Error('P0 rejected: matching-gender physical stage1 style reference missing');
 const ids=actorRefs.map(r=>r.id);
 if(new Set(ids).size!==ids.length||ids.includes('commander_'+(gender==='male'?'female':'male'))||
  actorRefs.some(r=>!isText(r.path)||!isText(r.sha)||!isText(r.rule)))
  throw Error('P0 rejected: conflicting or nonphysical actor reference');
 const script=shot.subtitleText||shot.text;
 const branch={
  pre:'Before the battle. Outcome UNKNOWN. No victory, loss, retreat or dead commander.',
  'post-victory':'After VERIFIED VICTORY. Commander survives. Successful stage objective may be shown.',
  'post-defeat':'After DEFEAT. No victory, no claimed achievement, no joyful return.',
  'post-gameover':'After commander DEATH. Do not portray the commander alive, returning or speaking.'
 }[edition];
 const scenes={
  'c01-s04':'Ancient overgrown stone ruins deep in a forest; an executed bell-keeper\'s emblem, old wax seal traces and the investigation. Forest moss, broken columns, mysterious late medieval stonework. Do not invent results of the investigation before a confirmed victory.',
  'c01-s05':'A besieged medieval town at the defensive perimeter: intact civilian evacuation routes, stone walls, guard barricades, retreating villagers and military formations appropriate to the specific shot. Do not depict defence as successful before confirmed victory.'
 };
 return [
  'P0 ABSOLUTE PER-SHOT CONTRACT. Render ONE original independent uninterrupted 16:9 high-end cinematic 3D-JRPG frame (NOT comic page). Failing ANY requirement makes the frame REJECTED, never auto-approved.',
  'P0 VISUAL STYLE LOCK: high-end Japanese 3D fantasy game cutscene, semi-photoreal CGI, intricate realistic skin pores/eyelids/irises, natural proportional human anatomy, highly detailed separate hair strands, physically-based metallic silver armor, tailored cloth and believable ambient shadow. Match Stage 1 approved visual direction and Stage 3 owner-accepted 3D cinematic look. Never switch to flat illustration, 2D manga, anime line art, cel shading, cartoon or stylized comic.',
  'P0 NO TEXT, PERIOD: absolutely zero visible letters, symbols, kanji, kana, Latin, digits, dialogue, speech balloons, caption boxes, narration, furigana, GAME OVER lettering, HUD, buttons, choice menus, logos, watermarks, panel numbering, sign-writing or textual strokes. No manga panel borders, page gutters, collage, posters, grids or inset images. Blank parchment, blank flags and unlettered maps if any appear. The screenplay is a PRIVATE visual instruction, never print it.',
  'P0 STAGE = '+stageId+' / '+stageName+'; EXACT SHOT KEY = '+[stageId,edition,gender,shot.id].join('|')+'. Both are metadata only, never image text.',
  'P0 TIME/RESULT STATE = '+branch,
  'P0 STAGE BACKGROUND = '+scenes[stageId],
  'P0 STAGE CANONICAL STORY CONTEXT (never print): '+stageStory,
  'P0 THIS SHOT ONLY = '+script,
  'P0 SHOT ACTUAL DIRECTING = scene kind '+(shot.kind||'unknown')+', scenery '+(shot.scenery||'stage-specific')+', expression '+(shot.expression||'script-consistent')+', mood '+(shot.mood||'script-consistent')+'. Depict THIS beat rather than a generic fantasy battle.',
  'P0 HERO IDENTITY = '+(gender==='female'?
   'female commander with long golden blonde hair, blue eyes, refined female face, silver armor and violet/gold-edged cloak; distinct from silver-haired regent Lucia.':
   'young dark-haired MALE commander from same-gender official source; never show the female commander as protagonist.'),
  'P0 VISIBLE CAST STRICT = '+(ids.length?ids.join(', '):'no named actor; only stage-specific inanimate environment')+'. Do not invent doubles, clones, extra protagonists, distant lookalikes, unnamed human faces or mixed-gender heroes.',
  ...actorRefs.map((ref,i)=>'P0 CHARACTER REFERENCE ATTACHMENT #'+i+' physically supplied: '+ref.id+' / '+ref.path+' / SHA256 '+ref.sha+'. Preserve exactly this actor\'s face, age, hairstyle, costume, body proportions and '+ref.rule+'. Do not swap persons or garments.'),
  'P0 STYLE REFERENCE ATTACHMENT physically supplied (not an additional character): '+styleRef.path+' / SHA256 '+styleRef.sha+'. Use it for quality/lighting/detail only, never copy its people into the scene.',
  'P0 CINEMA: one intentional dramatic camera angle with clear focal subject, plausible depth, controlled lighting, coherent shadows, cloth/armor continuity and readable action WITHOUT WORDS. Hands have anatomically correct fingers; armor does not float or intersect skin. Hair roots connect to scalp. No impossible faces.',
  'P0 BRANCH ISOLATION: keep male and female assets separate; keep victory, defeat, gameover separate. Never repurpose a prior unrelated outcome. The exact script and actors override any generic model style preference.',
  'P0 VALIDATION: save native original frame at >=1536x864 EXACT 16:9, do not upscale. Save sceneId, screenshot/image hash, real attached reference hashes, prompt hash and required human visual QA separately; DO NOT claim formal approval without it.'
 ].join('\n');
}
