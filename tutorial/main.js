
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

module.exports.loop = function ()
{
    for(var name in Game.rooms)
    {
        console.log('Room "'+name+'" has '+Game.rooms[name].energyAvailable+' energy');
    }

    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    console.log('Harvesters: ' + harvesters.length);

    if(harvesters.length < 2) {
        var newName = Game.spawns['Spawn1'].createCreep([WORK,CARRY,MOVE], undefined, {role: 'harvester'});
        console.log('Spawning new harvester: ' + newName);
    }

    if(Game.spawns['Spawn1'].spawning) {
        var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
        Game.spawns['Spawn1'].room.visual.text(
            '🛠️' + spawningCreep.memory.role,
            Game.spawns['Spawn1'].pos.x + 1,
            Game.spawns['Spawn1'].pos.y,
            {align: 'left', opacity: 0.8});
    }

    for(var name in Game.creeps)
    {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester')
        {
            roleHarvester.run(creep);
        }

        if(creep.memory.role == 'upgrader')
        {
            roleUpgrader.run(creep);
        }

        if(creep.memory.role == 'builder')
        {
            roleBuilder.run(creep);
        }
    }
}
