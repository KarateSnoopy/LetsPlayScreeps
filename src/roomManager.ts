import * as Config from "config";
import { log } from "./lib/logger/log";
import { profileRecord } from "./lib/Profiler";
import * as M from "./mem";
import { Builder } from "./internal";
import { Miner } from "miner";

export interface NodeContainerIdChoice
{
    id: string;
    count: number;
}

export interface NodeChoice
{
    x: number;
    y: number;
    dist: number;
}

export class RoomManager
{
    public static run(room: Room, rm: M.RoomMemory): void
    {
        profileRecord("scanRoom", true);
        RoomManager.scanRoom(room, rm);
        profileRecord("scanRoom", false);

        RoomManager.showSpawnTextIfSpawn(room, rm);

        profileRecord("buildMissingCreeps", true);
        RoomManager.buildMissingCreeps(room, rm);
        profileRecord("buildMissingCreeps", false);

        _.each(M.roomState.creeps, (creep: Creep) =>
        {
            const creepMem = M.cm(creep);
            if (creepMem.role === M.CreepRoles.ROLE_MINER)
            {
                profileRecord("miner.run", true);
                Miner.run(room, creep, rm);
                profileRecord("miner.run", false);
            }
            else if (creepMem.role === M.CreepRoles.ROLE_BUILDER)
            {
                profileRecord("builder.run", true);
                Builder.run(room, creep, rm);
                profileRecord("builder.run", false);
            }
            else
            {
                RoomManager.assignRoleToCreep(creep, creepMem);
            }
        });
    }

    private static showSpawnTextIfSpawn(room: Room, rm: M.RoomMemory): void
    {
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
    }

    private static assignRoleToCreep(creep: Creep, creepMem: M.MyCreepMemory): void
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

    private static getTechLevel(room: Room, rm: M.RoomMemory, numExtensionToBuild: number): number
    {
        // Tech level 1 = building miners
        // Tech level 2 = building containers
        // Tech level 3 = building builders
        // Tech level 4 = building extensions
        // Tech level 5 = ?

        if (M.roomState.miners.length < rm.minerTasks.length - 2)
        {
            return 1;
        }

        if (M.roomState.containers.length !== rm.energySources.length)
        {
            return 2;
        }

        if (M.roomState.builders.length < rm.desiredBuilders - 2)
        {
            return 3;
        }

        if (M.roomState.extensions.length < numExtensionToBuild)
        {
            return 4;
        }

        return 5;
    }

    private static scanRoom(room: Room, rm: M.RoomMemory)
    {
        M.roomState.creeps = room.find<FIND_MY_CREEPS>(FIND_MY_CREEPS);
        M.roomState.creepCount = _.size(M.roomState.creeps);
        M.roomState.miners = _.filter(M.roomState.creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_MINER);
        M.roomState.builders = _.filter(M.roomState.creeps, (creep) => M.cm(creep).role === M.CreepRoles.ROLE_BUILDER);
        M.roomState.structures = room.find<StructureContainer>(FIND_STRUCTURES);
        M.roomState.containers = _.filter(M.roomState.structures, (structure) => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer[];
        M.roomState.extensions = _.filter(M.roomState.structures, (structure) => structure.structureType === STRUCTURE_EXTENSION) as StructureExtension[];
        M.roomState.constructionSites = room.find<FIND_MY_CONSTRUCTION_SITES>(FIND_MY_CONSTRUCTION_SITES);
        M.roomState.constructionSites = _.sortBy(M.roomState.constructionSites, (constructionSite: ConstructionSite) => constructionSite.id);

        RoomManager.findNonRoadNeedingRepair(room, rm);

        let numTowersToBuild = RoomManager.getNumTowersToBuild(room);
        let numExtensionToBuild = RoomManager.getNumExtensionsToBuild(room);

        rm.techLevel = RoomManager.getTechLevel(room, rm, numExtensionToBuild);
        rm.energyLevel = RoomManager.getRoomEnergyLevel(rm, room);
        rm.buildsThisTick = 0;

        if (Game.time % 10 === 0)
        {
            RoomManager.buildExtension(rm, room, numExtensionToBuild);
        }

        if (Game.time % 50 === 0)
        {
            rm.extensionIdsAssigned = [];
        }

        if (Game.time % 100 === 0)
        {
            log.info(`TL=${rm.techLevel} Mem:${M.m().memVersion}/${M.MemoryVersion} M:${M.roomState.miners.length}/${rm.minerTasks.length} B:${M.roomState.builders.length}/${rm.desiredBuilders} S=${M.roomState.structures.length} Con=${M.roomState.containers.length}/${rm.containerPositions.length} Ext=${M.roomState.extensions.length}/${numExtensionToBuild} R:${M.roomState.notRoadNeedingRepair.length} E:${rm.extensionIdsAssigned.length} Eng:${rm.energyLevel}`);
        }
    }

    private static getNumTowersToBuild(room: Room): number
    {
        if (room.controller != null)
        {
            switch (room.controller.level)
            {
                case 2: return 0;
                case 3: return 1;
                case 4: return 1;
                case 5: return 2;
                case 6: return 2;
                case 7: return 3;
                case 8: return 8;
            }
        }

        return 0;
    }

    private static getNumExtensionsToBuild(room: Room): number
    {
        if (room.controller != null)
        {
            switch (room.controller.level)
            {
                case 2: return 5;
                case 3: return 10;
                case 4: return 20;
                case 5: return 30;
                case 6: return 40;
                case 7: return 50;
                case 8: return 60;
            }
        }

        return 0;
    }

    private static findNonRoadNeedingRepair(room: Room, rm: M.RoomMemory)
    {
        M.roomState.notRoadNeedingRepair = _.filter(M.roomState.structures, (structure) =>
        {
            if (structure.structureType !== STRUCTURE_ROAD)
            {
                if (structure.structureType === STRUCTURE_WALL)
                {
                    const hitsToRepair = rm.desiredWallHitPoints - structure.hits;
                    //if (hitsToRepair > rm.desiredWallHitPoints * 0.25)
                    if (hitsToRepair > 0)
                    {
                        return true;
                    }
                }
                else if (structure.structureType === STRUCTURE_RAMPART)
                {
                    const hitsToRepair = rm.desiredWallHitPoints - structure.hits;
                    if (hitsToRepair > rm.desiredWallHitPoints * 0.25)
                    {
                        return true;
                    }
                }
                else
                {
                    const hitsToRepair = structure.hitsMax - structure.hits;
                    if (hitsToRepair > structure.hitsMax * 0.25)
                    {
                        return true;
                    }
                }
            }

            return false;
        }) as StructureExtension[];

        M.roomState.notRoadNeedingRepair = _.sortBy(M.roomState.notRoadNeedingRepair, (struct: Structure) => struct.id);
    }

    private static buildMissingCreeps(room: Room, rm: M.RoomMemory)
    {
        let bodyParts: BodyPartConstant[];

        const inactiveSpawns: StructureSpawn[] = room.find<FIND_MY_SPAWNS>(FIND_MY_SPAWNS, {
            filter: (spawn: StructureSpawn) =>
            {
                return spawn.spawning === null;
            },
        });

        /*
        MOVE              50    Decreases fatigue by 2 points per tick.
        WORK              100   Harvests 2 energy units from a source per tick.
                                Builds a structure for 5 energy units per tick.
                                Repairs a structure for 100 hits per tick consuming 1 energy unit per tick.
                                Upgrades a controller for 1 energy unit per tick.
                                Dismantles a structure for 50 hits per tick returning 0.25 energy unit per tick.
        CARRY             50    Can contain up to 50 resource units.
        ATTACK            80    Attacks another creep/structure with 30 hits per tick in a short-ranged attack.
        RANGED_ATTACK     150   Attacks another single creep/structure with 10 hits per tick in a long-range attack up to 3 squares long.
                                Attacks all hostile creeps/structures within 3 squares range with 1-4-10 hits (depending on the range).
        HEAL              250   Heals self or another creep restoring 12 hits per tick in short range or 4 hits per tick at a distance.
        CLAIM             600   Claims a neutral room controller.
                                Reserves a neutral room controller for 1 tick per body part.
                                Attacks a hostile room controller downgrade or reservation timer with 1 tick per 5 body parts.
                                A creep with this body part will have a reduced life time of 500 ticks and cannot be renewed.
        TOUGH             10    No effect, just additional hit points to the creep's body.
        http://screeps.wikia.com/wiki/Creep#Movement
        */

        if (M.roomState.miners.length < rm.minerTasks.length)
        {
            switch (rm.energyLevel)
            {
                case 1: bodyParts = [WORK, WORK, CARRY, MOVE]; break; // 300
                case 2: bodyParts = [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE]; break; // 550
                default:
                case 3: bodyParts = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE]; break; // 6x100,3x50=750
            }

            RoomManager.tryToSpawnCreep(inactiveSpawns, bodyParts, M.CreepRoles.ROLE_MINER, rm);
        }

        if (rm.techLevel >= 3)
        {
            if (M.roomState.builders.length < rm.desiredBuilders)
            {
                switch (rm.energyLevel)
                {
                    case 1: bodyParts = [WORK, CARRY, CARRY, MOVE]; break; // 250
                    case 2: bodyParts = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]; break; // 550;
                    default:
                    case 3: bodyParts = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]; break; // 750;
                }

                RoomManager.tryToSpawnCreep(inactiveSpawns, bodyParts, M.CreepRoles.ROLE_BUILDER, rm);
            }
        }
    }

    private static tryToSpawnCreep(inactiveSpawns: StructureSpawn[], bodyParts: BodyPartConstant[], role: M.CreepRoles, rm: M.RoomMemory)
    {
        let spawned: boolean = false;
        _.each(inactiveSpawns, (spawn: StructureSpawn) =>
        {
            if (!spawned)
            {
                const status = RoomManager.spawnCreep(spawn, bodyParts, role, rm);
                if (status === OK)
                {
                    spawned = true;
                    return;
                }
            }
        });
    }

    private static spawnCreep(spawn: StructureSpawn, bodyParts: BodyPartConstant[], role: M.CreepRoles, rm: M.RoomMemory): number
    {
        const uuid: number = M.m().uuid;
        let status: number | string = spawn.canCreateCreep(bodyParts, undefined);

        status = _.isString(status) ? OK : status;
        if (status === OK)
        {
            M.m().uuid = M.m().uuid + 1;
            const creepName: string = spawn.room.name + "-" + M.roleToString(role) + "-" + uuid;

            const properties: M.MyCreepMemory =
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

    private static getOptimalExtensionPosition(room: Room, rm: M.RoomMemory, extPositions: RoomPosition[]): RoomPosition | null
    {
        const sources = room.find(FIND_SOURCES);
        const firstSpawn = RoomManager.getFirstSpawn(room);
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

    private static buildExtension(rm: M.RoomMemory, room: Room, numExtensionToBuild: number)
    {
        const extConstructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (structure: ConstructionSite) => (structure.structureType === STRUCTURE_EXTENSION) });
        const numExtensionsBuilt = M.roomState.extensions.length + extConstructionSites.length;
        const numExtensionsNeeded = numExtensionToBuild - numExtensionsBuilt;

        if (numExtensionsNeeded > 0)
        {
            const extPos: RoomPosition[] = [];
            _.each(M.roomState.extensions, (extension: StructureExtension) => extPos.push(extension.pos));
            _.each(extConstructionSites, (extension: ConstructionSite) => extPos.push(extension.pos));

            log.info(`numExtensionsNeeded=${numExtensionsNeeded}`);
            const roomPos: RoomPosition | null = RoomManager.getOptimalExtensionPosition(room, rm, extPos);
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

    public static initRoomMemory(room: Room, roomName: string)
    {
        const rm: M.RoomMemory = M.m().rooms[roomName];
        rm.roomName = roomName;
        rm.minerTasks = [];
        rm.energySources = [];
        rm.containerPositions = [];
        rm.extensionIdsAssigned = [];
        rm.desiredBuilders = 6;
        rm.techLevel = 0;
        rm.desiredWallHitPoints = 100000;

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

            const containerPos = RoomManager.getOptimalContainerPosition(minerTasksForSource, sourcePos, room);
            if (containerPos !== null)
            {
                rm.containerPositions.push(containerPos);
            }
        }
    }

    private static getFirstSpawn(room: Room): StructureSpawn | null
    {
        const spawns: StructureSpawn[] = room.find<FIND_MY_SPAWNS>(FIND_MY_SPAWNS);
        if (spawns.length === 0)
        {
            return null;
        }
        return spawns[0] as StructureSpawn;
    }

    private static getOptimalContainerPosition(minerTasksForSource: M.MinerTask[], sourcePos: M.PositionPlusTarget, room: Room): M.PositionPlusTarget | null
    {
        const roomPos: RoomPosition | null = room.getPositionAt(sourcePos.x, sourcePos.y);
        if (roomPos === null)
        {
            return null;
        }

        const firstSpawn = RoomManager.getFirstSpawn(room);
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

    public static cleanupAssignMiners(rm: M.RoomMemory)
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

    public static getContainerIdWithLeastBuildersAssigned(room: Room, rm: M.RoomMemory): string | undefined
    {
        const choices: NodeContainerIdChoice[] = [];

        _.each(M.roomState.containers, (container: StructureContainer) =>
        {
            let count = 0;
            _.each(M.roomState.builders, (tmpBuilder: Creep) =>
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

    private static getRoomEnergyLevel(rm: M.RoomMemory, room: Room): number
    {
        if ((rm.techLevel <= 4 && room.energyAvailable < 550) || M.roomState.miners.length < 2 || M.roomState.builders.length < 2)
        {
            return 1; // less than 550
        }
        else if (room.energyCapacityAvailable < 800)
        {
            return 2; // 550 + tech level 4
        }
        else
        {
            return 3; // 800+
        }
    }

    public static removeAssignedExt(targetId: string, rm: M.RoomMemory)
    {
        //log.info(`was rm.extensionIdsAssigned = ${rm.extensionIdsAssigned.length}`);
        _.remove(rm.extensionIdsAssigned, (ext: string) => ext === targetId);
        //log.info(`now rm.extensionIdsAssigned = ${rm.extensionIdsAssigned.length}`);
    }
}
