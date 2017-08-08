export const MemoryVersion = 4;

export const enum CreepRoles
{
    ROLE_UNASSIGNED = 0,
    ROLE_ALL,
    ROLE_BUILDER,
    ROLE_MINER,
    ROLE_MINEHAULER,
    ROLE_HEALER,
    ROLE_FIGHTER,
    ROLE_RANGER,
    ROLE_CLAIMER,
    ROLE_REMOTEMINER,
    ROLE_REMOTEMINEHAULER,
    ROLE_CUSTOMCONTROL,
    ROLE_UPGRADER,
    ROLE_UPGRADETRANSPORT
}

export function roleToString(job: CreepRoles): string
{
    switch (job)
    {
        case CreepRoles.ROLE_BUILDER: return "ROLE_BUILDER";
        case CreepRoles.ROLE_MINER: return "ROLE_MINER";
        case CreepRoles.ROLE_MINEHAULER: return "ROLE_MINEHAULER";
        case CreepRoles.ROLE_HEALER: return "ROLE_HEALER";
        case CreepRoles.ROLE_FIGHTER: return "ROLE_FIGHTER";
        case CreepRoles.ROLE_RANGER: return "ROLE_RANGER";
        case CreepRoles.ROLE_CLAIMER: return "ROLE_CLAIMER";
        case CreepRoles.ROLE_REMOTEMINER: return "ROLE_REMOTEMINER";
        case CreepRoles.ROLE_REMOTEMINEHAULER: return "ROLE_REMOTEMINEHAULER";
        case CreepRoles.ROLE_CUSTOMCONTROL: return "ROLE_CUSTOMCONTROL";
        default: return "unknown role";
    }
}

export interface MyPosition
{
    x: number;
    y: number;
}

export interface PositionPlusTarget
{
    x: number;
    y: number;
    targetId: string;
}

export interface RoomPositionPlusTarget
{
    roomTarget: string;
    x: number;
    y: number;
    targetId: string;
}

export interface MinerTask
{
    taskId: number;
    minerPosition: PositionPlusTarget;
    assignedMinerName?: string;

    //sourceContainer: PositionPlusTarget | undefined;
    //linkPullFrom: PositionPlusTarget | undefined;
    //linkPushTo: PositionPlusTarget | undefined;
    //linkPushToTarget: PositionPlusTarget | undefined;
    //desiredHaulers: number;
    //assignedHaulers: string[];
    //haulToStorage: boolean;
    //haulPos: MyPosition;
    //lastPickUpPos: MyPosition;
}

export class RoomMemory
{
    public roomName: string;
    public minerTasks: MinerTask[];
    public desiredBuilders: number;


    // public ticksSinceUpgrade : number;
    // public desiredWorkHaulers : number;
    // public desiredClaimers : number;
    // public desiredUpgraders : number;
    // public desiredUpgradeTransports : number;

    // public ticksSinceDesiredhaulers : number;
    // public spawnId : string | undefined;
    // public roomCount : RoomCount;
    // public buildsThisTick : number;
    // public paths: {[name: string]: string | undefined};
    // public workHaulerRallyPos : MyPosition;

    // public assignedCreepNames : string[];
    // public assignedTowers : string[];
    // public tasks : WorkTask[];
    // public energyTasks :  EnergyTask[];
    // public remoteminerTasks : RemoteMinerTask[];
    // public containerPositions : PositionPlusTarget[];
    // public sourcePositions : PositionPlusTarget[];
    // public attackWaves : AttackWave[];
    // public attackWavePlan : AttackWavePlan;
    // public desiredWallHitPoints : number;
    // public desiredEnergyInStorage : number;

    // public minerPositions : {[i: number]: number};

    public constructor(room: Room)
    {
        // M.ln(`initing room ${room.name}`);

        this.roomName = room.name;
        // this.desiredWallHitPoints = 10000;
        // this.desiredEnergyInStorage = 10000;
        // this.ticksSinceUpgrade = 0;
        // this.desiredWorkHaulers = 2;
        // this.desiredClaimers = 0;
        // this.desiredUpgraders = 0;
        // this.desiredUpgradeTransports = 0;

        // this.buildsThisTick = 0;
        // this.ticksSinceDesiredhaulers = 0;
        // this.roomCount =
        //     {
        //         workHaulers: 0,
        //         mineHaulers: 0,
        //         miners: 0,
        //         fighters: 0,
        //         healers: 0,
        //         rangers: 0,
        //         constructionSites: 0,
        //         injuredCreeps: 0,
        //         enemyCreeps: 0,
        //         extensions: 0,
        //         towers: 0,
        //         roadsBuilt: 0,
        //         energyDropped: 0,
        //         claimers: 0,
        //         remoteminers: 0,
        //         remotemineHaulers: 0,
        //         customControl: 0,
        //         upgraders: 0,
        //         upgradeTransports: 0
        //     };
        // if (room.name == 'sim')
        //     this.workHaulerRallyPos = { x: 20, y: 25 };
        // else
        //     this.workHaulerRallyPos = { x: 34, y: 12 };
        // this.assignedCreepNames = [];
        // this.assignedTowers = [];
        // this.tasks = [];
        // this.paths = {};
        // this.energyTasks = [];
        // this.minerTasks = [];
        // this.remoteminerTasks = [];
        // this.containerPositions = [];
        // this.sourcePositions = [];
        // this.attackWaves = [];
        // this.attackWavePlan = { desiredRangers: 0, desiredFighters: 0, desiredHealers: 0 };
    }
}

export interface GameMemory
{
    //[name: string]: any;

    memVersion: number | undefined;
    uuid: number;
    log: any;
    Profiler: Profiler;

    creeps:
    {
        [name: string]: any;
    };

    flags:
    {
        [name: string]: any;
    };

    rooms:
    {
        [name: string]: RoomMemory;
    };

    spawns:
    {
        [name: string]: any;
    };
}

export interface CreepMemory
{
    role: CreepRoles;
    roleString: string;
    log: boolean;
    gathering: boolean;
    // name: string;
    // roomName ?: string;
    // path ?: CreepPath;
    // assignedCreepTaskId ?: number;
    // assignedEnergyTaskId ?: number;
    assignedMineTaskId?: number;
    // assignedPullEnergyFromStorage : boolean;
    // attackWave ?: CreepAttackWaveMemory;
    // claimerRoomTarget ?: string;
    // customControl ?: number;
    // customControlState ?: number;
}

export function cm(creep: Creep): CreepMemory
{
    return creep.memory as CreepMemory;
}

export function m(): GameMemory
{
    return Memory as any as GameMemory;
}
