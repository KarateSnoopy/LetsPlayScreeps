import * as Profiler from "lib/Profiler";
import { log } from "./lib/logger/log";
import * as RoomManager from "./roomManager";
import * as M from "./mem";

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

function memoryInit()
{
    log.info("initing game");
    delete Memory.flags;
    delete Memory.spawns;
    delete Memory.creeps;
    delete Memory.rooms;

    const mem = M.m();
    mem.creeps = {};
    mem.rooms = {};

    mem.uuid = 0;
    //mem.logLevel = M.LogLevel.Low;
    mem.memVersion = M.MemoryVersion;
}

function mainLoop()
{
    if (M.m().memVersion === undefined ||
        M.m().memVersion !== M.MemoryVersion)
    {
        memoryInit();
    }

    if (!M.m().uuid || M.m().uuid > 1000)
    {
        M.m().uuid = 0;
    }

    for (const i in Game.rooms)
    {
        const room: Room = Game.rooms[i];
        const rm: M.RoomMemory = M.m().rooms[room.name];
        if (rm === undefined)
        {
            log.info(`Init room mem for ${room.name}`);
            Memory.rooms[room.name] = {};
            RoomManager.initRoomMemory(room, room.name);
        }
        else
        {
            RoomManager.run(room, rm);
        }

        if (Game.time % 10 === 0)
        {
            RoomManager.cleanupAssignMiners(rm);
        }
    }

    clearStaleCreepMemory();
}

export const loop = mainLoop;
