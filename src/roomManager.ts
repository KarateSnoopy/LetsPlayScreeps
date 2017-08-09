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
export let constructionSites: ConstructionSite[] = [];
export let extensions: StructureExtension[] = [];
export let notRoadNeedingRepair: Structure[] = [];

export function run(room: Room, rm: M.RoomMemory): void
{
    if (Game.time % 1 === 0)
    {
        profileRecord("scanRoom", true);
        scanRoom(room, rm);
        profileRecord("scanRoom", false);
    }

    if (rm.spawnText !== undefined && rm.spawnTextId !== undefined)
    {
        const spawn = Game.getObjectById(rm.spawnTextId) as StructureSpawn;

        room.visual.text(
            rm.spawnText,
            spawn.pos.x + 1,
            spawn.pos.y,
            { align: "left", opacity: 0.8 });

        if (spawn.spawning === null)
        {
            rm.spawnText = undefined;
        }
    }

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
            creepMem.name = creep.name;
            if (creep.name.search("ROLE_MINER") >= 0)
            {
                creepMem.role = M.CreepRoles.ROLE_MINER;
            }
            else if (creep.name.search("ROLE_BUILDER") >= 0)
            {
                creepMem.role = M.CreepRoles.ROLE_BUILDER;
            }
        }
    });
}

function getTechLevel(room: Room, rm: M.RoomMemory, numExtensionToBuild: number): number
{
    // Tech level 1 = building miners
    // Tech level 2 = building containers
    // Tech level 3 = building builders
    // Tech level 4 = ?

    if (miners.length < rm.minerTasks.length - 1)
    {
        return 1;
    }

    if (containers.length !== rm.energySources.length)
    {
        return 2;
    }

    if (builders.length < rm.desiredBuilders - 1)
    {
        return 3;
    }

    if (extensions.length < numExtensionToBuild)
    {
        return 4;
    }

    return 5;
}

function scanRoom(room: Room, rm: M.RoomMemory)
{
    creeps = room.find<Creep>(FIND_MY_CREEPS);
    creepCount = _.size(creeps);
    miners = _.filter(creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_MINER);
    builders = _.filter(creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_BUILDER);
    structures = room.find<StructureContainer>(FIND_STRUCTURES);
    containers = _.filter(structures, (structure) => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer[];
    extensions = _.filter(structures, (structure) => structure.structureType === STRUCTURE_EXTENSION) as StructureExtension[];
    notRoadNeedingRepair = _.filter(structures, (structure) =>
    {
        if (structure.structureType !== STRUCTURE_ROAD)
        {
            const hitsToRepair = structure.hitsMax - structure.hits;
            if (hitsToRepair > structure.hitsMax * 0.25)
            {
                return true;
            }
        }
        return false;
    }) as StructureExtension[];
    constructionSites = room.find<ConstructionSite>(FIND_MY_CONSTRUCTION_SITES);

    constructionSites = _.sortBy(constructionSites, (constructionSite: ConstructionSite) => constructionSite.id);
    notRoadNeedingRepair = _.sortBy(notRoadNeedingRepair, (struct: Structure) => struct.id);

    let numTownersToBuild = 0;
    let numExtensionToBuild = 0;
    if (room.controller != null)
    {
        switch (room.controller.level)
        {
            case 2: numTownersToBuild = 0; numExtensionToBuild = 5; break;
            case 3: numTownersToBuild = 1; numExtensionToBuild = 10; break;
            case 4: numTownersToBuild = 1; numExtensionToBuild = 20; break;
            case 5: numTownersToBuild = 2; numExtensionToBuild = 30; break;
            case 6: numTownersToBuild = 2; numExtensionToBuild = 40; break;
            case 7: numTownersToBuild = 3; numExtensionToBuild = 50; break;
            case 8: numTownersToBuild = 8; numExtensionToBuild = 60; break;
        }
    }

    rm.techLevel = getTechLevel(room, rm, numExtensionToBuild);
    rm.buildsThisTick = 0;

    if (Game.time % 10 === 0)
    {
        buildExtension(rm, room, numExtensionToBuild);
    }

    log.info(`TL=${rm.techLevel} Mem:${M.m().memVersion}/${M.MemoryVersion} M:${miners.length}/${rm.minerTasks.length} B:${builders.length}/${rm.desiredBuilders} S=${structures.length} Con=${containers.length}/${rm.containerPositions.length} Ext=${extensions.length}/${numExtensionToBuild} R:${notRoadNeedingRepair.length}`);
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

        tryToSpawnCreep(inactiveSpawns, bodyParts, M.CreepRoles.ROLE_MINER, rm);
    }

    if (rm.techLevel >= 3)
    {
        if (builders.length < rm.desiredBuilders)
        {
            bodyParts = [WORK, WORK, CARRY, MOVE];
            tryToSpawnCreep(inactiveSpawns, bodyParts, M.CreepRoles.ROLE_BUILDER, rm);
        }
    }
}

function tryToSpawnCreep(inactiveSpawns: Spawn[], bodyParts: string[], role: M.CreepRoles, rm: M.RoomMemory)
{
    let spawned: boolean = false;
    _.each(inactiveSpawns, (spawn: Spawn) =>
    {
        if (!spawned)
        {
            const status = spawnCreep(spawn, bodyParts, role, rm);
            if (status === OK)
            {
                spawned = true;
            }
        }
    });
}

function spawnCreep(spawn: Spawn, bodyParts: string[], role: M.CreepRoles, rm: M.RoomMemory): number
{
    const uuid: number = Memory.uuid;
    let status: number | string = spawn.canCreateCreep(bodyParts, undefined);

    status = _.isString(status) ? OK : status;
    if (status === OK)
    {
        Memory.uuid = uuid + 1;
        const creepName: string = spawn.room.name + "-" + M.roleToString(role) + "-" + uuid;

        const properties: M.CreepMemory =
            {
                name: creepName,
                log: false,
                gathering: true,
                role,
                roleString: M.roleToString(role),
                isUpgradingController: false
            };

        log.info("Started creating new creep: " + creepName);
        if (Config.ENABLE_DEBUG_MODE)
        {
            log.info("Body: " + bodyParts);
        }

        status = spawn.createCreep(bodyParts, creepName, properties);
        rm.spawnText = `🛠️ ${M.roleToString(role)}`;
        rm.spawnTextId = spawn.id;
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


function getOptimalExtensionPosition(room: Room, rm: M.RoomMemory, extPositions: RoomPosition[]): RoomPosition | null
{
    const sources = room.find(FIND_SOURCES);
    const firstSpawn = getFirstSpawn(room);
    if (firstSpawn == null)
    {
        return null;
    }

    const maxRange = 10;
    const choices: NodeChoice[] = [];
    log.info(`finding optimal extension pos`);
    for (let x = firstSpawn.pos.x - maxRange; x < firstSpawn.pos.x + maxRange; x++)
    {
        for (let y = firstSpawn.pos.y - maxRange; y < firstSpawn.pos.y + maxRange; y++)
        {
            const searchRoomPos: RoomPosition | null = room.getPositionAt(x, y);
            if (searchRoomPos !== null)
            {
                const found: string = searchRoomPos.lookFor(LOOK_TERRAIN) as any;
                if (found != "wall") //  tslint:disable-line
                {
                    let tooClose = false;
                    for (const extensionPos of extPositions)
                    {
                        const rangeToExt = extensionPos.getRangeTo(x, y);
                        if (rangeToExt <= 1)
                        {
                            tooClose = true;
                            break;
                        }
                    }

                    if (tooClose)
                    {
                        continue;
                    }

                    let range = 0;
                    _.each(sources, (source: Source) =>
                    {
                        const rangeToSource = source.pos.getRangeTo(x, y);
                        if (rangeToSource <= 3)
                        {
                            tooClose = true;
                        }
                        range += rangeToSource;
                    });
                    if (tooClose)
                    {
                        continue;
                    }

                    const rangeToSpawn = firstSpawn.pos.getRangeTo(x, y);
                    range += rangeToSpawn;
                    if (rangeToSpawn <= 2)
                    {
                        continue;
                    }

                    //log.info(`Choice is ${x}, ${y} == ${range}`);
                    const choice: NodeChoice =
                        {
                            x, y, dist: range
                        };
                    choices.push(choice);
                }
            }
        }
    }

    const sortedChoices = _.sortBy(choices, (choice: NodeChoice) => choice.dist);
    if (sortedChoices.length > 0)
    {
        log.info(`Best choice is ${sortedChoices[0].x}, ${sortedChoices[0].y} == ${sortedChoices[0].dist}`);
        const roomPos: RoomPosition | null = room.getPositionAt(sortedChoices[0].x, sortedChoices[0].y);
        return roomPos;
    }

    return null;
}

function buildExtension(rm: M.RoomMemory, room: Room, numExtensionToBuild: number)
{
    const extConstructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (structure: ConstructionSite) => (structure.structureType === STRUCTURE_EXTENSION) });
    const numExtensionsBuilt = extensions.length + extConstructionSites.length;
    const numExtensionsNeeded = numExtensionToBuild - numExtensionsBuilt;

    if (numExtensionsNeeded > 0)
    {
        const extPos: RoomPosition[] = [];
        _.each(extensions, (extension: StructureExtension) => extPos.push(extension.pos));
        _.each(extConstructionSites, (extension: ConstructionSite) => extPos.push(extension.pos));

        log.info(`numExtensionsNeeded=${numExtensionsNeeded}`);
        const roomPos: RoomPosition | null = getOptimalExtensionPosition(room, rm, extPos);
        if (roomPos != null)
        {
            const errCode = room.createConstructionSite(roomPos, STRUCTURE_EXTENSION);
            if (errCode === OK)
            {
                log.info(`Created extension at ${roomPos}`);
                return;
            }
            else
            {
                log.info(`ERROR: created extension at ${roomPos} ${errCode}`);
            }
        }
        else
        {
            log.info(`ERROR: coudln't create more extensions`);
        }
    }
}

export function initRoomMemory(room: Room, roomName: string)
{
    const rm: M.RoomMemory = M.m().rooms[roomName];
    rm.roomName = roomName;
    rm.minerTasks = [];
    rm.energySources = [];
    rm.containerPositions = [];
    rm.desiredBuilders = 6;
    rm.techLevel = 0;

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

export function getFirstSpawn(room: Room): StructureSpawn | null
{
    const spawns: Spawn[] = room.find<Spawn>(FIND_MY_SPAWNS);
    if (spawns.length === 0)
    {
        return null;
    }
    return spawns[0] as StructureSpawn;
}

function getOptimalContainerPosition(minerTasksForSource: M.MinerTask[], sourcePos: M.PositionPlusTarget, room: Room): M.PositionPlusTarget | null
{
    const roomPos: RoomPosition | null = room.getPositionAt(sourcePos.x, sourcePos.y);
    if (roomPos === null)
    {
        return null;
    }

    const firstSpawn = getFirstSpawn(room);
    if (firstSpawn == null)
    {
        return null;
    }

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
