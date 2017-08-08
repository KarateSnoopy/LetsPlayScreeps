import * as M from "./mem";
import { log } from "./lib/logger/log";
import * as RoomManager from "./roomManager";

export function run(room: Room, creep: Creep, rm: M.RoomMemory): void
{
    const cm = M.cm(creep);
    if (cm.assignedContainerId === undefined)
    {
        cm.assignedContainerId = RoomManager.getContainerIdWithLeastBuildersAssigned(room, rm);
    }

    if (cm.assignedContainerId === undefined)
    {
        log.error(`${creep.name} is not assigned to container`);
        return;
    }

    if (cm.gathering && creep.carry.energy === creep.carryCapacity)
    {
        cm.gathering = false;
    }
    if (!cm.gathering && creep.carry.energy === 0)
    {
        cm.gathering = true;
    }

    if (cm.gathering)
    {
        //log.info(`${creep.name} builder is moving to container`);
        pickupEnergy(creep, cm, rm);
    }
    else
    {
        //log.info(`${creep.name} builder is using energy`);
        useEnergy(room, creep);
    }
}

function pickupEnergy(creep: Creep, cm: M.CreepMemory, rm: M.RoomMemory): void
{
    const target = Game.getObjectById(cm.assignedContainerId) as StructureContainer;
    if (target == null)
    {
        cm.assignedContainerId = undefined;
        return;
    }

    let energyCount = 0;
    if (creep.carry.energy !== undefined)
    {
        energyCount = creep.carry.energy;
    }

    const amtEnergy = creep.carryCapacity - energyCount;
    const errCode = creep.withdraw(target, RESOURCE_ENERGY, amtEnergy);
    if (errCode === ERR_NOT_IN_RANGE)
    {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
    }

    if (errCode !== OK && errCode !== ERR_NOT_IN_RANGE && errCode !== ERR_NOT_ENOUGH_RESOURCES)
    {
        log.error(`Transfer error ${errCode}`);
    }
}

function useEnergy(room: Room, creep: Creep): void
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
    else
    {
        if (room.controller !== undefined)
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


export function buildIfCan(room: Room, creep: Creep): boolean
{
    log.info(`buildIfCan ${room.name}, ${creep.name}`);

    const targets = room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];
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
        return false;
    }
}
