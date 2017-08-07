import * as Config from "config";
import * as miner from "./miner";
import { log } from "./lib/logger/log";
import { profileRecord } from "./lib/Profiler";
import * as M from "./mem";

export let creeps: Creep[];
export let creepCount: number = 0;
export let miners: Creep[] = [];

export function run(room: Room, rm: M.RoomMemory): void
{
    rm.roomName = "3";

    profileRecord("_loadCreeps", true);
    _loadCreeps(room);
    profileRecord("_loadCreeps", false);

    profileRecord("_buildMissingCreeps", true);
    _buildMissingCreeps(room);
    profileRecord("_buildMissingCreeps", false);

    _.each(creeps, (creep: Creep) =>
    {
        const creepMem = M.cm(creep);
        if (creepMem.role === M.CreepRoles.ROLE_MINER)
        {
            profileRecord("miner.run", true);
            miner.run(creep);
            profileRecord("miner.run", false);
        }
    });
}

function _loadCreeps(room: Room)
{
    creeps = room.find<Creep>(FIND_MY_CREEPS);
    creepCount = _.size(creeps);
    miners = _.filter(creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_MINER);
}

function _buildMissingCreeps(room: Room)
{
    let bodyParts: string[];

    const spawns: Spawn[] = room.find<Spawn>(FIND_MY_SPAWNS, {
        filter: (spawn: Spawn) =>
        {
            return spawn.spawning === null;
        },
    });

    if (miners.length < 2)
    {
        if (miners.length < 1 || room.energyCapacityAvailable <= 800)
        {
            bodyParts = [WORK, WORK, CARRY, MOVE];
        } else if (room.energyCapacityAvailable > 800)
        {
            bodyParts = [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        }

        _.each(spawns, (spawn: Spawn) =>
        {
            _spawnCreep(spawn, bodyParts, M.CreepRoles.ROLE_MINER);
        });
    }
}

function _spawnCreep(spawn: Spawn, bodyParts: string[], role: M.CreepRoles)
{
    const uuid: number = Memory.uuid;
    let status: number | string = spawn.canCreateCreep(bodyParts, undefined);

    const properties: M.CreepMemory =
        {
            log: false,
            role,
            roleString: M.roleToString(role)
        };

    status = _.isString(status) ? OK : status;
    if (status === OK)
    {
        Memory.uuid = uuid + 1;
        const creepName: string = spawn.room.name + " - " + role + uuid;

        log.info("Started creating new creep: " + creepName);
        if (Config.ENABLE_DEBUG_MODE)
        {
            log.info("Body: " + bodyParts);
        }

        status = spawn.createCreep(bodyParts, creepName, properties);

        return _.isString(status) ? OK : status;
    }
    else
    {
        if (Config.ENABLE_DEBUG_MODE && status !== ERR_NOT_ENOUGH_ENERGY)
        {
            log.info("Failed creating new creep: " + status);
        }

        return status;
    }
}
