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
        M.lerr(cm, `not assigned to container`);
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
        //M.l(cm, `builder is moving to container`);
        pickupEnergy(creep, cm, rm);
    }
    else
    {
        //M.l(cm, `builder is using energy`);
        useEnergy(room, creep, cm);
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

    //creep.say(`withdrawing`);
    const amtEnergy = creep.carryCapacity - energyCount;
    const errCode = creep.withdraw(target, RESOURCE_ENERGY, amtEnergy);
    if (errCode === ERR_NOT_IN_RANGE)
    {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
    }

    if (errCode !== OK && errCode !== ERR_NOT_IN_RANGE && errCode !== ERR_NOT_ENOUGH_RESOURCES)
    {
        M.l(cm, `Transfer error ${errCode}`);
    }
}

function useEnergy(room: Room, creep: Creep, cm: M.CreepMemory): void
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
        //creep.say(`transfering`);
        if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
        {
            creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
        }
    }
    else
    {
        if (room.controller !== undefined)
        {
            creep.say(`upgrading`);
            const status = creep.upgradeController(room.controller);
            if (status === ERR_NOT_IN_RANGE)
            {
                const moveCode = creep.moveTo(room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
                if (moveCode !== OK && moveCode !== ERR_TIRED)
                {
                    M.l(cm, `move and got ${moveCode}`);
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
                M.l(cm, `move and got ${moveCode}`);
            }
        }
        return true;
    }
    else
    {
        return false;
    }
}

function tryToBuildExtension(rm: M.RoomMemory, creep: Creep, cm: M.CreepMemory, room: Room)
{
    // build extensions close to sources
    let closeToSource = false;
    for (const sourcePos of rm.energySources)
    {
        const sourceRoomPos = room.getPositionAt(sourcePos.x, sourcePos.y);
        if (sourceRoomPos != null)
        {
            const range = sourceRoomPos.getRangeTo(creep.pos);
            if (range < 12)
            {
                M.l(cm, `Range To Source: ${range}`);
                closeToSource = true;
                break;
            }
        }
    }

    const firstSpawn = RoomManager.getFirstSpawn(room);
    let closeToSpawn = true;
    if (firstSpawn != null)
    {
        closeToSpawn = false;

        // and close to spawn if spawn in room
        const range = firstSpawn.pos.getRangeTo(creep.pos);
        if (range < 6 && range > 2)
        {
            closeToSpawn = true;
            M.l(cm, `Range To Spawn: ${range}`);
        }
    }

    if (closeToSource && closeToSpawn)
    {
        M.l(cm, `trying to build extension`);

        let tooCloseToOther = false;
        const extensions = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }) as StructureExtension[];
        for (const extension of extensions)
        {
            const range = extension.pos.getRangeTo(creep);
            if (range <= 1)
            {
                M.l(cm, `Too close to another extension: ${range}`);
                tooCloseToOther = true;
                break;
            }
        }

        if (!tooCloseToOther)
        {
            const extensionConstructionSites = _.filter(RoomManager.constructionSites, (site: ConstructionSite) => site.structureType === STRUCTURE_EXTENSION);
            for (const constructionSite of extensionConstructionSites)
            {
                const range = constructionSite.pos.getRangeTo(creep);
                if (range <= 1)
                {
                    M.l(cm, `Too close to another ext const site: ${range}`);
                    tooCloseToOther = true;
                    break;
                }
            }
        }

        if (!tooCloseToOther)
        {
            const errCode = creep.room.createConstructionSite(creep.pos, STRUCTURE_EXTENSION);
            if (errCode === OK)
            {
                M.l(cm, `Creep created extension at ${creep.pos}`);
                //rm.roomCount.constructionSites++;
                rm.buildsThisTick++;
                return;
            }
            else
            {
                M.l(cm, `ERROR: created extension at ${creep.pos} ${errCode}`);
            }
        }
    }
}
