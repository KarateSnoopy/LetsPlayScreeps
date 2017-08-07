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

function initRoomMemory(room: Room, roomName: string)
{
    const rm: M.RoomMemory = M.m().rooms[roomName];
    rm.roomName = roomName;
    rm.minerTasks = [];

    const sources = room.find(FIND_SOURCES);
    for (const sourceName in sources)
    {
        const source: Source = sources[sourceName] as Source;
        const positions = [
            [source.pos.x - 1, source.pos.y - 1],
            [source.pos.x - 1, source.pos.y + 0],
            [source.pos.x - 1, source.pos.y + 1],

            [source.pos.x + 1, source.pos.y - 1],
            [source.pos.x + 1, source.pos.y + 0],
            [source.pos.x + 1, source.pos.y + 1],

            [source.pos.x + 0, source.pos.y - 1],
            [source.pos.x + 0, source.pos.y + 1]
        ];

        for (const pos of positions)
        {
            const roomPos: RoomPosition | null = room.getPositionAt(pos[0], pos[1]);
            if (roomPos !== null)
            {
                const found: string = roomPos.lookFor(LOOK_TERRAIN) as any;
                if (found != "wall") //  tslint:disable-line
                {
                    log.info("pos " + pos[0] + "," + pos[1] + "=" + found);
                    const minerPos: M.PositionPlusTarget =
                        {
                            targetId: source.id,
                            x: pos[0],
                            y: pos[1]
                        };
                    const minerTask: M.MinerTask =
                        {
                            minerPosition: minerPos
                        };

                    rm.minerTasks.push(minerTask);
                }
            }
        }
    }
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

    log.info("Time: " + Game.time + " MemVer: " + M.m().memVersion + " WantMemVer: " + M.MemoryVersion);

    for (const i in Game.rooms)
    {
        const room: Room = Game.rooms[i];
        const rm: M.RoomMemory = M.m().rooms[room.name];
        if (rm === undefined)
        {
            log.info("Init room mem for " + room.name);
            Memory.rooms[room.name] = {};
            initRoomMemory(room, room.name);
        }
        else
        {
            RoomManager.run(room, rm);
        }
    }

    clearStaleCreepMemory();
}

export const loop = mainLoop;
