import * as M from "./mem";
import { log } from "./lib/logger/log";
import * as RoomManager from "./roomManager";

export function run(room: Room, creep: Creep, rm: M.RoomMemory): void
{
    const cm = M.cm(creep);
    if (cm.assignedMineTaskId === undefined)
    {
        log.info(`${creep.name} miner has no mining task`);
        const unassignedTasks = _.filter(rm.minerTasks, (t: M.MinerTask) => t.assignedMinerName === undefined);
        log.info(`unassignedTask.length: ${unassignedTasks.length}`);
        if (unassignedTasks.length === 0)
        {
            log.error("No unassigned miner tasks found");
        }
        else
        {
            unassignedTasks[0].assignedMinerName = creep.name;
            cm.assignedMineTaskId = unassignedTasks[0].taskId;
            log.info(`Now assigned miner task ${cm.assignedMineTaskId}`);
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
        //log.info(`${creep.name} got miner task ${minerTask.taskId}`);

        if (!cm.gathering)
        {
            //log.info(`${creep.name} miner is working on dropping off`);
            dropOffEnergy(room, creep, rm, minerTask);
        }
        else
        {
            //log.info(`${creep.name} miner is moving to mine`);
            harvestEnergy(creep, cm, rm, minerTask);
        }
    }
}

function harvestEnergy(creep: Creep, cm: M.CreepMemory, rm: M.RoomMemory, minerTask: M.MinerTask): void
{
    //log.info(`${creep.name} miner is moving to mine`);

    if (creep.pos.x !== minerTask.minerPosition.x ||
        creep.pos.y !== minerTask.minerPosition.y)
    {
        //log.info(`${creep.name} is not in position at ${minerTask.minerPosition.x}, ${minerTask.minerPosition.y}`);
        const pos = creep.room.getPositionAt(minerTask.minerPosition.x, minerTask.minerPosition.y);
        if (pos !== null)
        {
            creep.moveTo(pos, { visualizePathStyle: { stroke: "#0000ff" } });
        }
        else
        {
            log.error(`Can't find ${pos}`);
        }
    }
    else
    {
        //log.info(`${creep.name} is in position at ${minerTask.minerPosition.x}, ${minerTask.minerPosition.y}`);
        const source = Game.getObjectById(minerTask.minerPosition.targetId) as Source;
        const errCode = creep.harvest(source);
        if (errCode !== OK && errCode !== ERR_NOT_IN_RANGE && errCode !== ERR_NOT_ENOUGH_RESOURCES)
        {
            log.error(`Harvest error ${errCode}`);
        }
    }
}

function buildIfCan(room: Room, creep: Creep, rm: M.RoomMemory): boolean
{
    log.info(`buildIfCan ${room.name}, ${creep.name}`);

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
                log.error(`move and got ${moveCode}`);
            }
        }
        return true;
    }
    else
    {
        // Do I have all construction sites for all the containers?
        if (RoomManager.containers.length !== rm.containerPositions.length)
        {
            log.info(`RoomManager.containers.length=${RoomManager.containers.length}. rm.containerPositions.length=${rm.containerPositions.length}`);
            _.each(rm.containerPositions, (containerPos: M.PositionPlusTarget) =>
            {
                log.info(`Creating container at ${containerPos.x}, ${containerPos.y}`);
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

function dropOffEnergy(room: Room, creep: Creep, rm: M.RoomMemory, minerTask: M.MinerTask): void
{
    let target: Structure | undefined;

    if (minerTask.sourceContainer === undefined ||
        RoomManager.builders.length + 1 >= rm.desiredBuilders)
    {
        if (RoomManager.containers.length === rm.containerPositions.length &&
            RoomManager.builders.length + 1 >= rm.desiredBuilders)
        {
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
                        // log.info(`Found matching containerPos ${target.id}`);
                    }
                }
            }
        }

        if (target === undefined)
        {
            const targets: Structure[] = creep.room.find(FIND_STRUCTURES,
                {
                    filter: (structure: Structure) =>
                    {
                        if (structure.structureType === STRUCTURE_EXTENSION)
                        {
                            const structExt: StructureExtension = structure as StructureExtension;
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
            }
        }
    }
    else
    {
        target = Game.getObjectById(minerTask.sourceContainer.targetId) as Structure;
        log.info(`Going to ${target}`);
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
                isBuilding = buildIfCan(room, creep, rm);
            }

            if (!isBuilding)
            {
                const status = creep.upgradeController(room.controller);
                if (status === ERR_NOT_IN_RANGE)
                {
                    const moveCode = creep.moveTo(room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
                    if (moveCode !== OK && moveCode !== ERR_TIRED)
                    {
                        log.error(`move and got ${moveCode}`);
                    }
                }
            }
        }
    }
}
