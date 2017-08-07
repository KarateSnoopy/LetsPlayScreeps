export function run(creep: Creep): void
{
    if (_.sum(creep.carry) === creep.carryCapacity)
    {
        dropOffEnergy(creep);
    }
    else
    {
        const energySource = creep.room.find<Source>(FIND_SOURCES_ACTIVE)[0];
        moveToMine(creep, energySource);
    }
}

function moveToMine(creep: Creep, target: Source): void
{
    if (creep.harvest(target) === ERR_NOT_IN_RANGE)
    {
        creep.moveTo(target.pos);
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
