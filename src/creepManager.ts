import * as Config from "config";
import * as harvester from "./harvester";
import { log } from "./lib/logger/log";
import { profileRecord } from "./lib/Profiler";

export let creeps: Creep[];
export let creepCount: number = 0;
export let harvesters: Creep[] = [];

export function run(room: Room): void
{
    profileRecord("_loadCreeps", true);
    _loadCreeps(room); +
        profileRecord("_loadCreeps", false);

    profileRecord("_buildMissingCreeps", true);
    _buildMissingCreeps(room);
    profileRecord("_buildMissingCreeps", false);

    _.each(creeps, (creep: Creep) =>
    {
        if (creep.memory.role === "harvester")
        {
            profileRecord("harvester.run", true);
            harvester.run(creep);
            profileRecord("harvester.run", false);
        }
    });
}

function _loadCreeps(room: Room)
{
    creeps = room.find<Creep>(FIND_MY_CREEPS);
    creepCount = _.size(creeps);
    harvesters = _.filter(creeps, (creep) => creep.memory.role === "harvester");
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

    if (harvesters.length < 2)
    {
        if (harvesters.length < 1 || room.energyCapacityAvailable <= 800)
        {
            bodyParts = [WORK, WORK, CARRY, MOVE];
        } else if (room.energyCapacityAvailable > 800)
        {
            bodyParts = [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        }

        _.each(spawns, (spawn: Spawn) =>
        {
            _spawnCreep(spawn, bodyParts, "harvester");
        });
    }
}

function _spawnCreep(spawn: Spawn, bodyParts: string[], role: string)
{
    const uuid: number = Memory.uuid;
    let status: number | string = spawn.canCreateCreep(bodyParts, undefined);

    const properties: { [key: string]: any } = {
        role,
        room: spawn.room.name,
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
    } else
    {
        if (Config.ENABLE_DEBUG_MODE && status !== ERR_NOT_ENOUGH_ENERGY)
        {
            log.info("Failed creating new creep: " + status);
        }

        return status;
    }
}
