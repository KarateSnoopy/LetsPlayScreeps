interface Memory
{
    uuid: number;
    log: any;
    Profiler: Profiler;
}

declare namespace NodeJS
{
    interface Global
    {
        log: any;
        Profiler: Profiler;
    }
}

declare const __REVISION__: string;
