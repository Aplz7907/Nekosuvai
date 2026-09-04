import { CLAW } from './claw';
import { EMBER } from './ember';
import { FISH } from './fish';
import { HAIRBALL } from './hairball';
import { KAMINARI } from './kaminari';
import { YARN } from './yarn';
import type { WeaponDef, WeaponId } from './types';

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  claw: CLAW,
  hairball: HAIRBALL,
  yarn: YARN,
  fish: FISH,
  kaminari: KAMINARI,
  ember: EMBER,
};

export const WEAPON_IDS: WeaponId[] = ['claw', 'hairball', 'yarn', 'fish', 'kaminari', 'ember'];
