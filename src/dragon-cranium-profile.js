/** Cross-sections of the Ancient Dragon's adult skull, from nape to muzzle. */
export function dragonCraniumProfile(width, height, length, headY=0, headZ=0){
 return [
  [headZ-length*.37,headY-.035,.014,.044],
  [headZ-length*.12,headY+.025,width*.385,height*.164],
  [headZ+length*.11,headY+.03,width*.42,height*.172],
  [headZ+length*.30,headY-.04,width*.34,height*.125],
  [headZ+length*.52,headY-.104,width*.265,height*.092],
  [headZ+length*.73,headY-.125,width*.194,height*.075],
  [headZ+length*.84,headY-.126,.008,.020],
 ];
}
