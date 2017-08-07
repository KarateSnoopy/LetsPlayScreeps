export const enum CreepRoles
{
    ROLE_UNASSIGNED = 0,
    ROLE_ALL,
    ROLE_WORKER,
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
        case CreepRoles.ROLE_WORKER: return "ROLE_WORKER";
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

export interface CreepMemory
{
    role: CreepRoles;
    roleString: string;
    log: boolean;
    // name: string;
    // roomName ?: string;
    // path ?: CreepPath;
    // assignedCreepTaskId ?: number;
    // assignedEnergyTaskId ?: number;
    // assignedMineTaskId ?: number;
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
