import * as M from "./mem";
import { log } from "./lib/logger/log";
import * as RoomManager from "./roomManager";

export function run(room: Room, creep: Creep, rm: M.RoomMemory): void
{
    const cm = M.cm(creep);
    if (cm.assignedMineTaskId === undefined)
    {
        log.info(`${M.l(cm)}has no mining task`);
        const unassignedTasks = _.filter(rm.minerTasks, (t: M.MinerTask) => t.assignedMinerName === undefined);
        log.info(`unassignedTask.length: ${unassignedTasks.length}`);
        if (unassignedTasks.length === 0)
        {
            log.info(`${M.l(cm)}No unassigned miner tasks found`);
        }
        else
        {
            unassignedTasks[0].assignedMinerName = creep.name;
            cm.assignedMineTaskId = unassignedTasks[0].taskId;
            log.info(`${M.l(cm)}Now assigned miner task ${cm.assignedMineTaskId}`);
        }
    }
    else
    {
        if (cm.gathering && creep.carry.energy === creep.carryCapacity)
        {
            cm.gathering = false;
        }
        if (!cm.gathering && creep.carry.energy === 0)
        {
            cm.gathering = true;
        }

        const minerTask = rm.minerTasks.find((t: M.MinerTask) => t.taskId === cm.assignedMineTaskId);
        if (minerTask === undefined)
        {
            return;
        }
        //log.info(`${M.l(cm)}got miner task ${minerTask.taskId }`);

        if (!cm.gathering)
        {
            //log.info(`${M.l(cm)}is working on dropping off`);
            dropOffEnergy(room, creep, rm, minerTask, cm);
        }
        else
        {
            //log.info(`${M.l(cm)}is moving to mine`);
            harvestEnergy(creep, cm, rm, minerTask);
        }
    }
}

function harvestEnergy(creep: Creep, cm: M.CreepMemory, rm: M.RoomMemory, minerTask: M.MinerTask): void
{
    //log.info(`${M.l(cm)}is moving to mine`);

    if (creep.pos.x !== minerTask.minerPosition.x ||
        creep.pos.y !== minerTask.minerPosition.y)
    {
        //log.info(`${M.l(cm)}is not in position at ${minerTask.minerPosition.x }, ${minerTask.minerPosition.y }`);
        const pos = creep.room.getPositionAt(minerTask.minerPosition.x, minerTask.minerPosition.y);
        if (pos !== null)
        {
            creep.moveTo(pos, { visualizePathStyle: { stroke: "#0000ff" } });
        }
        else
        {
            log.error(`${M.l(cm)}Can't find ${pos}`);
        }
    }
    else
    {
        //log.info(`${M.l(cm)}is in position at ${minerTask.minerPosition.x}, ${minerTask.minerPosition.y}`);
        const source = Game.getObjectById(minerTask.minerPosition.targetId) as Source;
        const errCode = creep.harvest(source);
        if (errCode !== OK && errCode !== ERR_NOT_IN_RANGE && errCode !== ERR_NOT_ENOUGH_RESOURCES)
        {
            log.error(`${M.l(cm)}Harvest error ${errCode}`);
        }
    }
}

function buildIfCan(room: Room, creep: Creep, rm: M.RoomMemory, cm: M.CreepMemory): boolean
{
    log.info(`${M.l(cm)}buildIfCan ${room.name}, ${creep.name}`);

    // Find container construction sites
    const targets = room.find(FIND_CONSTRUCTION_SITES,
        {
            filter: (constructionSite: ConstructionSite) =>
            {
                return (constructionSite.structureType === STRUCTURE_CONTAINER);
            }
        }) as ConstructionSite[];

    if (targets.length > 0)
    {
        const status = creep.build(targets[0]);
        if (status === ERR_NOT_IN_RANGE)
        {
            const moveCode = creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
            if (moveCode !== OK && moveCode !== ERR_TIRED)
            {
                log.error(`${M.l(cm)}move and got ${moveCode}`);
            }
        }
        return true;
    }
    else
    {
        // Do I have all construction sites for all the containers?
        if (RoomManager.containers.length !== rm.containerPositions.length)
        {
            log.info(`${M.l(cm)}RoomManager.containers.length=${RoomManager.containers.length}. rm.containerPositions.length=${rm.containerPositions.length}`);
            _.each(rm.containerPositions, (containerPos: M.PositionPlusTarget) =>
            {
                log.info(`${M.l(cm)}Creating container at ${containerPos.x}, ${containerPos.y}`);
                const roomPos: RoomPosition | null = room.getPositionAt(containerPos.x, containerPos.y);
                if (roomPos !== null)
                {
                    creep.room.createConstructionSite(roomPos, STRUCTURE_CONTAINER);
                }
            });
        }

        return false;
    }
}

function dropOffEnergy(room: Room, creep: Creep, rm: M.RoomMemory, minerTask: M.MinerTask, cm: M.CreepMemory): void
{
    let target: Structure | undefined;

    if (minerTask.sourceContainer === undefined ||
        rm.techLevel < 3)
    {
        log.info(`${M.l(cm)}no source container or low tech`);
        if (RoomManager.containers.length === rm.containerPositions.length &&
            rm.techLevel >= 3)
        {
            log.info(`${M.l(cm)}room has containers and tech 3+`);
            const foundContainerPos = _.find(rm.containerPositions, (containerPos: M.PositionPlusTarget) => containerPos.targetId === minerTask.minerPosition.targetId);
            if (foundContainerPos !== null)
            {
                const roomPos: RoomPosition | null = room.getPositionAt(foundContainerPos.x, foundContainerPos.y);
                if (roomPos !== null)
                {
                    const targets = roomPos.lookFor<Structure>("structure") as Structure[];
                    if (targets.length > 0)
                    {
                        target = targets[0];
                        log.info(`${M.l(cm)}Found matching containerPos ${target.id}`);
                        minerTask.sourceContainer =
                            {
                                targetId: target.id,
                                x: target.pos.x,
                                y: target.pos.y
                            };
                    }
                }
            }
        }

        if (target === undefined)
        {
            log.info(`${M.l(cm)}looking for non-container target`);
            const targets: Structure[] = creep.room.find(FIND_STRUCTURES,
                {
                    filter: (structure: Structure) =>
                    {
                        if (structure.structureType === STRUCTURE_EXTENSION)
                        {
                            const structExt: StructureExtension = structure as StructureExtension;
                            log.info(`found ext`);
                            return structExt.energy < structExt.energyCapacity;
                        }
                        if (structure.structureType === STRUCTURE_SPAWN)
                        {
                            const structSpawn: StructureSpawn = structure as StructureSpawn;
                            return structSpawn.energy < structSpawn.energyCapacity;
                        }
                        if (structure.structureType === STRUCTURE_TOWER)
                        {
                            const structTower: StructureTower = structure as StructureTower;
                            return structTower.energy < structTower.energyCapacity;
                        }

                        return false;
                    }
                });

            if (targets.length > 0)
            {
                target = targets[0];
                creep.say(`custom`);
            }
        }
    }
    else
    {
        //log.info(`${M.l(cm)}container = ${minerTask.sourceContainer.targetId}`);
        target = Game.getObjectById(minerTask.sourceContainer.targetId) as Structure;
        //log.info(`${M.l(cm)}target = ${target}`);
        if (target === null)
        {
            minerTask.sourceContainer = undefined;
        }
        //creep.say(`unloading`);
        //log.info(`${M.l(cm)}Going to ${target}`);
    }

    if (target !== undefined)
    {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
        {
            creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
    }
    else
    {
        if (room.controller !== undefined)
        {
            let isBuilding = false;
            if (room.controller.ticksToDowngrade > 1000)
            {
                isBuilding = buildIfCan(room, creep, rm, cm);
            }

            if (!isBuilding)
            {
                creep.say(`upgrading`);
                const status = creep.upgradeController(room.controller);
                if (status === ERR_NOT_IN_RANGE)
                {
                    const moveCode = creep.moveTo(room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
                    if (moveCode !== OK && moveCode !== ERR_TIRED)
                    {
                        log.error(`${M.l(cm)}move and got ${moveCode}`);
                    }
                }
            }
        }
    }
}
