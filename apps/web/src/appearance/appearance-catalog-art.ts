import back from './appearance-catalog-back.generated'
import beard from './appearance-catalog-beard.generated'
import body from './appearance-catalog-body.generated'
import directionHair from './appearance-catalog-dirHair.generated'
import fA from './appearance-catalog-fA.generated'
import fB from './appearance-catalog-fB.generated'
import fC from './appearance-catalog-fC.generated'
import fD from './appearance-catalog-fD.generated'
import facewear from './appearance-catalog-facewear.generated'
import gA from './appearance-catalog-gA.generated'
import gB from './appearance-catalog-gB.generated'
import gear from './appearance-catalog-gear.generated'
import hA from './appearance-catalog-hA.generated'
import hB from './appearance-catalog-hB.generated'
import hC from './appearance-catalog-hC.generated'
import hD from './appearance-catalog-hD.generated'
import hE from './appearance-catalog-hE.generated'
import hF from './appearance-catalog-hF.generated'
import hands from './appearance-catalog-hands.generated'
import hats from './appearance-catalog-hats.generated'
import mA from './appearance-catalog-mA.generated'
import mB from './appearance-catalog-mB.generated'
import mC from './appearance-catalog-mC.generated'
import mD from './appearance-catalog-mD.generated'
import patterns from './appearance-catalog-patterns.generated'
import sceneA from './appearance-catalog-sceneA.generated'
import sceneB from './appearance-catalog-sceneB.generated'
import sceneC from './appearance-catalog-sceneC.generated'
import sceneD from './appearance-catalog-sceneD.generated'
import sceneE from './appearance-catalog-sceneE.generated'
import sceneF from './appearance-catalog-sceneF.generated'
import side from './appearance-catalog-side.generated'
import sleeves from './appearance-catalog-sleeves.generated'
import studio from './appearance-catalog-studio.generated'

export const CATALOG_FACE_ART = { ...fA, ...fB, ...fC, ...fD, ...mA, ...mB, ...mC, ...mD }
export const CATALOG_HAIR_ART = { ...hA, ...hB, ...hC, ...hD, ...hE, ...hF }
export const CATALOG_GARMENT_ART = { ...gA, ...gB }
export const CATALOG_WORN_ART = { ...beard, ...gear, ...hats, ...facewear }
export const CATALOG_BACKDROP_ART = {
  ...studio,
  ...patterns,
  ...sceneA,
  ...sceneB,
  ...sceneC,
  ...sceneD,
  ...sceneE,
  ...sceneF,
}
export const CATALOG_SPRITE_BODY = body
export const CATALOG_SPRITE_HANDS = hands
export const CATALOG_DIRECTION_HAIR = directionHair
export const CATALOG_SPRITE_SLEEVES = sleeves
export const CATALOG_SPRITE_SIDE = side
export const CATALOG_SPRITE_BACK = back
