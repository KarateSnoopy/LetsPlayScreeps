interface Memory
{
    uuid: number;
    log: any;
    Profiler: Profiler;
}

// add objects to `global` here
// NodeJS already declares global, so we need to extend it here:
// tslint:disable-next-line
declare namespace NodeJS
{
    interface Global
    {
        log: any;
        Profiler: Profiler;
    }
}

declare const __REVISION__: string;
