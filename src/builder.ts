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

    tryToBuildRoad(rm, creep, room, cm);
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
    }

    if (room.controller !== undefined && room.controller.ticksToDowngrade < 1000)
    {
        target = undefined;
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
        if (room.controller !== undefined && room.controller.ticksToDowngrade > 1000)
        {
            if (repairIfCan(room, creep, cm))
            {
                return;
            }

            if (buildIfCan(room, creep, cm))
            {
                return;
            }
        }

        if (room.controller !== undefined)
        {
            cm.isUpgradingController = true;
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

function repairIfCan(room: Room, creep: Creep, cm: M.CreepMemory): boolean
{
    let repairTarget: Structure | undefined;
    if (RoomManager.notRoadNeedingRepair.length > 0)
    {
        repairTarget = RoomManager.notRoadNeedingRepair[0];
    }

    if (repairTarget === undefined)
    {
        const structuresUnderFeet = creep.pos.lookFor(LOOK_STRUCTURES) as Structure[];
        if (structuresUnderFeet.length > 0)
        {
            const roadsUnderFeed = _.filter(structuresUnderFeet, (structure) => structure.structureType === STRUCTURE_ROAD) as StructureRoad[];
            if (roadsUnderFeed.length > 0)
            {
                if (roadsUnderFeed[0].hits + 50 < roadsUnderFeed[0].hitsMax)
                {
                    repairTarget = roadsUnderFeed[0];
                }
            }
        }
    }

    if (repairTarget !== undefined)
    {
        const status = creep.repair(repairTarget);
        if (status === ERR_NOT_IN_RANGE)
        {
            const moveCode = creep.moveTo(repairTarget, { visualizePathStyle: { stroke: "#ffffff" } });
            if (moveCode !== OK && moveCode !== ERR_TIRED)
            {
                log.info(`${M.l(cm)}move and got ${moveCode}`);
            }
        }
        return true;
    }

    return false;
}

function buildIfCan(room: Room, creep: Creep, cm: M.CreepMemory): boolean
{
    if (RoomManager.constructionSites.length > 0)
    {
        const status = creep.build(RoomManager.constructionSites[0]);
        if (status === ERR_NOT_IN_RANGE)
        {
            const moveCode = creep.moveTo(RoomManager.constructionSites[0], { visualizePathStyle: { stroke: "#ffffff" } });
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


function tryToBuildRoad(rm: M.RoomMemory, creep: Creep, room: Room, cm: M.CreepMemory)
{
    if ((Game.time + 5) % 10 === 0)
    {
        if (rm.techLevel >= 5 && rm.buildsThisTick === 0)
        {
            const errCode = creep.room.createConstructionSite(creep.pos, STRUCTURE_ROAD);
            if (errCode === OK)
            {
                log.info(`${M.l(cm)} Created road at ${creep.pos}`);
                rm.buildsThisTick++;
                return;
            }
        }
    }
}
