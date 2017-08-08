import * as Config from "config";
import * as miner from "./miner";
import * as builder from "./builder";
import { log } from "./lib/logger/log";
import { profileRecord } from "./lib/Profiler";
import * as M from "./mem";

export let creeps: Creep[];
export let creepCount: number = 0;
export let miners: Creep[] = [];
export let builders: Creep[] = [];
export let structures: Structure[] = [];
export let containers: StructureContainer[] = [];

export function run(room: Room, rm: M.RoomMemory): void
{
    profileRecord("loadCreeps", true);
    loadCreeps(room, rm);
    profileRecord("loadCreeps", false);

    profileRecord("buildMissingCreeps", true);
    buildMissingCreeps(room, rm);
    profileRecord("buildMissingCreeps", false);

    _.each(creeps, (creep: Creep) =>
    {
        const creepMem = M.cm(creep);
        if (creepMem.role === M.CreepRoles.ROLE_MINER)
        {
            profileRecord("miner.run", true);
            miner.run(room, creep, rm);
            profileRecord("miner.run", false);
        }
        else if (creepMem.role === M.CreepRoles.ROLE_BUILDER)
        {
            profileRecord("builder.run", true);
            builder.run(room, creep, rm);
            profileRecord("builder.run", false);
        }
        else
        {
            creepMem.role = M.CreepRoles.ROLE_MINER;
        }
    });
}

function loadCreeps(room: Room, rm: M.RoomMemory)
{
    creeps = room.find<Creep>(FIND_MY_CREEPS);
    creepCount = _.size(creeps);
    miners = _.filter(creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_MINER);
    builders = _.filter(creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_BUILDER);
    structures = room.find<StructureContainer>(FIND_STRUCTURES);
    containers = _.filter(structures, (structure) => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer[];

    log.info(`Mem:${M.m().memVersion}/${M.MemoryVersion} M:${miners.length}/${rm.minerTasks.length} B:${builders.length}/${rm.desiredBuilders} S=${structures.length} Con=${containers.length}/${rm.containerPositions.length}`);
}

function buildMissingCreeps(room: Room, rm: M.RoomMemory)
{
    let bodyParts: string[];

    const inactiveSpawns: Spawn[] = room.find<Spawn>(FIND_MY_SPAWNS, {
        filter: (spawn: Spawn) =>
        {
            return spawn.spawning === null;
        },
    });

    if (miners.length < rm.minerTasks.length)
    {
        bodyParts = [WORK, WORK, CARRY, MOVE];
        // if (miners.length < 1 || room.energyCapacityAvailable <= 800)
        // {
        //     bodyParts = [WORK, WORK, CARRY, MOVE];
        // } else if (room.energyCapacityAvailable > 800)
        // {
        //     bodyParts = [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        // }

        tryToSpawnCreep(inactiveSpawns, bodyParts, M.CreepRoles.ROLE_MINER);
    }

    if (miners.length === rm.minerTasks.length)
    {
        if (containers.length === rm.energySources.length)
        {
            if (builders.length < rm.desiredBuilders)
            {
                bodyParts = [WORK, WORK, CARRY, MOVE];
                tryToSpawnCreep(inactiveSpawns, bodyParts, M.CreepRoles.ROLE_BUILDER);
            }
        }
    }
}

function tryToSpawnCreep(inactiveSpawns: Spawn[], bodyParts: string[], role: M.CreepRoles)
{
    let spawned: boolean = false;
    _.each(inactiveSpawns, (spawn: Spawn) =>
    {
        if (!spawned)
        {
            const status = spawnCreep(spawn, bodyParts, role);
            if (status === OK)
            {
                spawned = true;
            }
        }
    });
}

function spawnCreep(spawn: Spawn, bodyParts: string[], role: M.CreepRoles): number
{
    const uuid: number = Memory.uuid;
    let status: number | string = spawn.canCreateCreep(bodyParts, undefined);

    const properties: M.CreepMemory =
        {
            log: false,
            gathering: true,
            role,
            roleString: M.roleToString(role),
        };

    status = _.isString(status) ? OK : status;
    if (status === OK)
    {
        Memory.uuid = uuid + 1;
        const creepName: string = spawn.room.name + " - " + M.roleToString(role) + uuid;

        log.info("Started creating new creep: " + creepName);
        if (Config.ENABLE_DEBUG_MODE)
        {
            log.info("Body: " + bodyParts);
        }

        status = spawn.createCreep(bodyParts, creepName, properties);
        if (status === OK)
        {
            spawn.room.visual.text(
                `🛠️ ${role}`,
                spawn.pos.x + 1,
                spawn.pos.y,
                { align: "left", opacity: 0.8 });

        }
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

export function initRoomMemory(room: Room, roomName: string)
{
    const rm: M.RoomMemory = M.m().rooms[roomName];
    rm.roomName = roomName;
    rm.minerTasks = [];
    rm.energySources = [];
    rm.containerPositions = [];
    rm.desiredBuilders = 2;

    let taskIdNum = 0;

    const sources = room.find(FIND_SOURCES);
    for (const sourceName in sources)
    {
        const source: Source = sources[sourceName] as Source;

        const sourcePos: M.PositionPlusTarget =
            {
                targetId: source.id,
                x: source.pos.x,
                y: source.pos.y
            };
        rm.energySources.push(sourcePos);

        const positions = [
            [source.pos.x - 1, source.pos.y - 1],
            [source.pos.x - 1, source.pos.y + 0],
            [source.pos.x - 1, source.pos.y + 1],

            [source.pos.x + 1, source.pos.y - 1],
            [source.pos.x + 1, source.pos.y + 0],
            [source.pos.x + 1, source.pos.y + 1],

            [source.pos.x + 0, source.pos.y - 1],
            [source.pos.x + 0, source.pos.y + 1]
        ];

        const minerTasksForSource: M.MinerTask[] = [];
        for (const pos of positions)
        {
            const roomPos: RoomPosition | null = room.getPositionAt(pos[0], pos[1]);
            if (roomPos !== null)
            {
                const found: string = roomPos.lookFor(LOOK_TERRAIN) as any;
                if (found != "wall") //  tslint:disable-line
                {
                    log.info("pos " + pos[0] + "," + pos[1] + "=" + found);
                    const minerPos: M.PositionPlusTarget =
                        {
                            targetId: source.id,
                            x: pos[0],
                            y: pos[1]
                        };
                    taskIdNum++;
                    const minerTask: M.MinerTask =
                        {
                            minerPosition: minerPos,
                            taskId: taskIdNum,
                            sourceContainer: undefined
                        };

                    rm.minerTasks.push(minerTask);
                    minerTasksForSource.push(minerTask);
                }
            }
        }

        const containerPos = getOptimalContainerPosition(minerTasksForSource, sourcePos, room);
        if (containerPos !== null)
        {
            rm.containerPositions.push(containerPos);
        }
    }
}

interface NodeChoice
{
    x: number;
    y: number;
    dist: number;
}

function getOptimalContainerPosition(minerTasksForSource: M.MinerTask[], sourcePos: M.PositionPlusTarget, room: Room): M.PositionPlusTarget | null
{
    const roomPos: RoomPosition | null = room.getPositionAt(sourcePos.x, sourcePos.y);
    if (roomPos === null)
    {
        return null;
    }

    const spawns: Spawn[] = room.find<Spawn>(FIND_MY_SPAWNS);
    if (spawns.length === 0)
    {
        return null;
    }
    const firstSpawn = spawns[0];

    const choices: NodeChoice[] = [];
    log.info(`finding optimal container pos for ${sourcePos.x}, ${sourcePos.y}`);
    for (let x = sourcePos.x - 2; x <= sourcePos.x + 2; x++)
    {
        for (let y = sourcePos.y - 2; y <= sourcePos.y + 2; y++)
        {
            const range = roomPos.getRangeTo(x, y);
            if (range === 2)
            {
                const searchPos: RoomPosition | null = room.getPositionAt(x, y);
                if (searchPos !== null)
                {
                    const found: string = searchPos.lookFor(LOOK_TERRAIN) as any;
                    if (found != "wall") //  tslint:disable-line
                    {
                        // log.info(`${x}, ${y} == ${range} is not wall`);

                        let dist = _.sum(minerTasksForSource, (task: M.MinerTask) =>
                        {
                            const taskPos: RoomPosition | null = room.getPositionAt(task.minerPosition.x, task.minerPosition.y);
                            if (taskPos === null)
                            {
                                return 0;
                            }
                            else
                            {
                                return taskPos.getRangeTo(x, y);
                            }
                        });
                        // log.info(`${x}, ${y} == ${dist} total`);
                        dist += firstSpawn.pos.getRangeTo(x, y);
                        log.info(`${x}, ${y} == ${dist} total dist including to spawn`);

                        const choice: NodeChoice =
                            {
                                x, y, dist
                            };
                        choices.push(choice);
                    }
                }
            }
        }
    }

    const sortedChoices = _.sortBy(choices, (choice: NodeChoice) => choice.dist);
    if (sortedChoices.length > 0)
    {
        log.info(`Best choice is ${sortedChoices[0].x}, ${sortedChoices[0].y} == ${sortedChoices[0].dist}`);
        const containerPos: M.PositionPlusTarget =
            {
                targetId: sourcePos.targetId,
                x: sortedChoices[0].x,
                y: sortedChoices[0].y
            };

        return containerPos;
    }

    return null;
}

export function cleanupAssignMiners(rm: M.RoomMemory)
{
    for (const task of rm.minerTasks)
    {
        if (task.assignedMinerName !== undefined)
        {
            const creep = Game.creeps[task.assignedMinerName];
            if (creep as any === undefined)
            {
                log.info(`Clearing mining task assigned to ${task.assignedMinerName}`);
                task.assignedMinerName = undefined;
            }
            else if (M.cm(creep).role !== M.CreepRoles.ROLE_MINER)
            {
                log.info(`Clearing mining task assigned to ${task.assignedMinerName}`);
                task.assignedMinerName = undefined;
            }
        }
    }
}

interface NodeContainerIdChoice
{
    id: string;
    count: number;
}

export function getContainerIdWithLeastBuildersAssigned(room: Room, rm: M.RoomMemory): string | undefined
{
    const choices: NodeContainerIdChoice[] = [];

    _.each(containers, (container: StructureContainer) =>
    {
        let count = 0;
        _.each(builders, (tmpBuilder: Creep) =>
        {
            if (M.cm(tmpBuilder).assignedContainerId === container.id)
            {
                count++;
            }
        });

        const choice: NodeContainerIdChoice =
            {
                id: container.id, count
            };
        log.info(`Container ${container.id} = ${count}`);
        choices.push(choice);
    });

    const sortedChoices = _.sortBy(choices, (choice: NodeContainerIdChoice) => choice.count);
    if (sortedChoices.length > 0)
    {
        log.info(`Best container ${sortedChoices[0].id} = ${sortedChoices[0].count}`);
        return sortedChoices[0].id;
    }

    return undefined;
}
