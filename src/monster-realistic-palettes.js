/**
 * Naturalistic bestiary art direction. Fantasy identity is concentrated in
 * ornaments and VFX, while flesh, hair, bone, linen and velvet use restrained
 * physical pigments. The catalogue/stat data remains untouched.
 */
export const MONSTER_REALISTIC_PALETTE=Object.freeze({
 m031:Object.freeze({skin:'#777b72',light:'#a6a89a',bone:'#d2c5ab',
   hair:'#302b29',fabric:'#463e3c',mortalSkin:'#828479',eye:'#493e32'}),
 m032:Object.freeze({skin:'#59634d',light:'#879177',bone:'#b8aa8c',
   bandage:'#b7ab91',hair:'#363029',mortalSkin:'#58644b',eye:'#39342d'}),
 m033:Object.freeze({skin:'#4b536b',light:'#666e83',bone:'#aaa8a0',
   metal:'#6d7880',fabric:'#34404e',mortalSkin:'#656f80',
   hair:'#25262d',eye:'#4a6872'}),
 m034:Object.freeze({skin:'#64546c',light:'#84738b',bone:'#c6aba4',
   mortalSkin:'#77748e',fabric:'#30262d',leather:'#393034',
   hair:'#252025',eye:'#722c39',bandage:'#bcae9e'}),
 m035:Object.freeze({skin:'#536c75',light:'#78919a',bone:'#b6b5a5',
   mortalSkin:'#547b83',fabric:'#363541',hair:'#32323b',eye:'#7a8290'}),
 m041:Object.freeze({skin:'#5c4b70',light:'#836a93',bone:'#b9aa92',
   mortalSkin:'#635079',fabric:'#393039',hair:'#35272d',eye:'#927768'}),
 m042:Object.freeze({skin:'#495963',light:'#71848c',bone:'#9e9081',
   mortalSkin:'#52636f',fabric:'#4a4549',hair:'#323034',eye:'#77635d'}),
 m043:Object.freeze({skin:'#723539',light:'#a04d50',bone:'#c6a58e',
   mortalSkin:'#87373c',fabric:'#3f3432',hair:'#352321',eye:'#9a6848'}),
 m044:Object.freeze({skin:'#5a416e',light:'#866397',bone:'#bfb1a6',
   mortalSkin:'#76518f',fabric:'#382a39',hair:'#251f29',eye:'#694e68'}),
 m045:Object.freeze({skin:'#4a4155',light:'#716a80',bone:'#aca59a',
   mortalSkin:'#625168',fabric:'#2c2b31',metal:'#646267',
   hair:'#27262b',eye:'#7b5e62'}),
});
export function realismPaletteFor(spec){
 return MONSTER_REALISTIC_PALETTE[spec?.id]??null;
}
