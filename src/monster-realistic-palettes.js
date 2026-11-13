/**
 * Naturalistic bestiary art direction. Fantasy identity is concentrated in
 * ornaments and VFX, while flesh, hair, bone, linen and velvet use restrained
 * physical pigments. The catalogue/stat data remains untouched.
 */
export const MONSTER_REALISTIC_PALETTE=Object.freeze({
 m031:Object.freeze({skin:'#827968',light:'#b1a88c',bone:'#d2c5ab',
   hair:'#302b29',fabric:'#463e3c',mortalSkin:'#968878',eye:'#493e32'}),
 m032:Object.freeze({skin:'#675e50',light:'#998d77',bone:'#b8aa8c',
   bandage:'#b7ab91',hair:'#363029',mortalSkin:'#776953',eye:'#39342d'}),
 m033:Object.freeze({skin:'#464f5b',light:'#667281',bone:'#aaa8a0',
   metal:'#6d7880',fabric:'#34404e',mortalSkin:'#6f787b',
   hair:'#25262d',eye:'#4a6872'}),
 m034:Object.freeze({skin:'#5b4651',light:'#846b76',bone:'#c6aba4',
   mortalSkin:'#aea19d',fabric:'#30262d',leather:'#393034',
   hair:'#252025',eye:'#722c39',bandage:'#bcae9e'}),
 m035:Object.freeze({skin:'#635f6c',light:'#888592',bone:'#b6b5a5',
   mortalSkin:'#8e918c',fabric:'#363541',hair:'#32323b',eye:'#7a8290'}),
 m041:Object.freeze({skin:'#61535c',light:'#8a777e',bone:'#b9aa92',
   mortalSkin:'#86797a',fabric:'#393039',hair:'#35272d',eye:'#927768'}),
 m042:Object.freeze({skin:'#55545a',light:'#827b78',bone:'#9e9081',
   mortalSkin:'#716967',fabric:'#4a4549',hair:'#323034',eye:'#77635d'}),
 m043:Object.freeze({skin:'#6b4845',light:'#956661',bone:'#c6a58e',
   mortalSkin:'#815c54',fabric:'#3f3432',hair:'#352321',eye:'#9a6848'}),
 m044:Object.freeze({skin:'#594956',light:'#857182',bone:'#bfb1a6',
   mortalSkin:'#a58b92',fabric:'#382a39',hair:'#251f29',eye:'#694e68'}),
 m045:Object.freeze({skin:'#42444b',light:'#6d6c70',bone:'#aca59a',
   mortalSkin:'#747075',fabric:'#2c2b31',metal:'#646267',
   hair:'#27262b',eye:'#7b5e62'}),
});
export function realismPaletteFor(spec){
 return MONSTER_REALISTIC_PALETTE[spec?.id]??null;
}
