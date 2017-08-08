import * as M from "./mem";
import { log } from "./lib/logger/log";

export function run(creep: Creep, rm: M.RoomMemory): void
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
        if (_.sum(creep.carry) === creep.carryCapacity)
        {
            //log.info(`${creep.name} miner is working on dropping off`);
            dropOffEnergy(creep);
        }
        else
        {
            //log.info(`${creep.name} miner is moving to mine`);
            moveToMine(creep, cm, rm);
        }
    }
}

function moveToMine(creep: Creep, cm: M.CreepMemory, rm: M.RoomMemory): void
{
    //log.info(`${creep.name} miner is moving to mine`);
    const minerTask = rm.minerTasks.find((t: M.MinerTask) => t.taskId === cm.assignedMineTaskId);
    if (minerTask === undefined)
    {
        return;
    }
    //log.info(`${creep.name} got miner task ${minerTask.taskId}`);

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

function dropOffEnergy(creep: Creep): void
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
        if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
        {
            creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
        }
    }
}
