export interface Monster {
    index: number;
    name: string;
    level: number;
    hp: number;
    mp: number;
    damageMin: number;
    damageMax: number;
    defense: number;
    magicDefense: number;
    attackRate: number;
    blockRate: number;
    moveRange: number;
    attackType: number;
    attackRange: number;
    viewRange: number;
    moveSpeed: number;
    attackSpeed: number;
    regenTime: number;
    attribute: number;
    itemDropRate: number;
    moneyDropRate: number;
    maxItemLevel: number;
    monsterSkill: string;
    [key: string]: string | number;
}

export interface Spawn {
    uuid: string;
    index: number;
    distance: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    dir: number;
    count: number;
    element?: number;
    monsterName?: string;
}

export interface Spot {
    type: number;
    description: string;
    spawns: Spawn[];
}

export interface MapData {
    number: number;
    name: string;
    spots: Spot[];
}

export interface MapInfo {
    number: number;
    file: string;
    name?: string;
}

export enum SpotType {
    NPC = 0,
    MultiSpawn = 1,
    SingleSpawn = 2,
    ElementalSpawn = 3,
}
