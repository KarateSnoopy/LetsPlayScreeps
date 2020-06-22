// add your custom typings here
declare var global: any

// `global` extension samples
declare namespace NodeJS
{
    interface Global
    {
        log: any;
    }
}
