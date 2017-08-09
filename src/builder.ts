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

    room.visual.text(
        `🛠️`,
        creep.pos.x,
        creep.pos.y,
        { align: "center", opacity: 0.8 });

    if (cm.assignedContainerId === undefined)
    {
        //log.error(`${M.l(cm)}not assigned to container`);
        return;
    }

    if (rm.buildsThisTick === 0)
    {
        //tryToBuildExtension(rm, creep, cm, room);
    }

    if (cm.gathering && creep.carry.energy === creep.carryCapacity)
    {
        cm.gathering = false;
    }
    if (!cm.gathering && creep.carry.energy === 0)
    {
        cm.gathering = true;
        cm.isUpgradingController = false;
        cm.assignedTargetId = undefined;
    }

    if (cm.gathering)
    {
        //log.info(`${M.l(cm)}builder is moving to container`);
        pickupEnergy(creep, cm, rm);
    }
    else
    {
        //log.info(`${M.l(cm)}builder is using energy`);
        useEnergy(room, creep, cm);
    }
}

function pickupEnergy(creep: Creep, cm: M.CreepMemory, rm: M.RoomMemory): void
{
    const target = Game.getObjectById(cm.assignedContainerId) as StructureContainer;
    if (target === null)
    {
        cm.assignedContainerId = undefined;
        return;
    }

    let energyCount = 0;
    if (creep.carry.energy !== undefined)
    {
        energyCount = creep.carry.energy;
    }

    //creep.say(`withdrawing`);
    const amtEnergy = creep.carryCapacity - energyCount;
    const errCode = creep.withdraw(target, RESOURCE_ENERGY, amtEnergy);
    if (errCode === ERR_NOT_IN_RANGE)
    {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
    }

    if (errCode !== OK && errCode !== ERR_NOT_IN_RANGE && errCode !== ERR_NOT_ENOUGH_RESOURCES)
    {
        log.info(`${M.l(cm)}Transfer error ${errCode}`);
    }
}

function isStructureFullOfEnergy(structure: Structure): boolean
{
    if (structure.structureType === STRUCTURE_EXTENSION)
    {
        const structExt: StructureExtension = structure as StructureExtension;
        return structExt.energy >= structExt.energyCapacity;
    }
    if (structure.structureType === STRUCTURE_SPAWN)
    {
        const structSpawn: StructureSpawn = structure as StructureSpawn;
        return structSpawn.energy >= structSpawn.energyCapacity;
    }
    if (structure.structureType === STRUCTURE_TOWER)
    {
        const structTower: StructureTower = structure as StructureTower;
        return structTower.energy >= structTower.energyCapacity;
    }

    return true;
}



function useEnergy(room: Room, creep: Creep, cm: M.CreepMemory): void
{
    let target: Structure | undefined;
    if (cm.assignedTargetId !== undefined)
    {
        target = Game.getObjectById(cm.assignedTargetId) as Structure;
        if (isStructureFullOfEnergy(target))
        {
            cm.assignedTargetId = undefined;
            target = undefined;
        }
    }

    //log.info(`${M.l(cm)}cm.assignedTargetId=${cm.assignedTargetId} cm.isUpgradingController=${cm.isUpgradingController}`);
    if (cm.assignedTargetId === undefined &&
        !cm.isUpgradingController)
    {
        const targets: Structure[] = creep.room.find(FIND_STRUCTURES,
            {
                filter: (structure: Structure) =>
                {
                    return !isStructureFullOfEnergy(structure);
                }
            });
        if (targets.length > 0)
        {
            target = targets[0];
            cm.assignedTargetId = target.id;
        }
        else
        {
            cm.isUpgradingController = true;
        }
    }

    if (target !== undefined)
    {
        //creep.say(`transfering`);
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
        {
            creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
    }
    else
    {
        if (room.controller !== undefined)
        {
            //creep.say(`upgrading`);
            const status = creep.upgradeController(room.controller);
            if (status === ERR_NOT_IN_RANGE)
            {
                const moveCode = creep.moveTo(room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
                if (moveCode !== OK && moveCode !== ERR_TIRED)
                {
                    log.info(`${M.l(cm)}move and got ${moveCode}`);
                }
            }
        }
    }
}


export function buildIfCan(room: Room, creep: Creep, cm: M.CreepMemory): boolean
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
                log.info(`${M.l(cm)}move and got ${moveCode}`);
            }
        }
        return true;
    }
    else
    {
        return false;
    }
}
