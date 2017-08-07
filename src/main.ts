import * as Profiler from "lib/Profiler";
import { log } from "./lib/logger/log";
import * as RoomManager from "./roomManager";

global.Profiler = Profiler.init();

function clearStaleCreepMemory()
{
    if (Game.time % 100 === 0)
    {
        // log.info("Checking creep mem: " + Game.time);
        for (const name in Memory.creeps)
        {
            if (!Game.creeps[name])
            {
                log.info("Clearing non-existing creep memory:", name);
                delete Memory.creeps[name];
            }
        }
    }
}

function mainLoop()
{
    if (!Memory.uuid || Memory.uuid > 1000)
    {
        Memory.uuid = 0;
    }

    log.info("Time: " + Game.time);

    for (const i in Game.rooms)
    {
        const room: Room = Game.rooms[i];
        RoomManager.run(room);
    }

    clearStaleCreepMemory();
}

export const loop = mainLoop;
