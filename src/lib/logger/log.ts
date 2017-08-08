import * as Config from "../../config";
import { LogLevels } from "./logLevels";

// <caller> (<source>:<line>:<column>)
const stackLineRe = /([^ ]*) \(([^:]*):([0-9]*):([0-9]*)\)/;

interface SourcePos
{
    compiled: string;
    final: string;
    original: string | undefined;
    caller: string | undefined;
    path: string | undefined;
    line: number | undefined;
}

export function resolve(fileLine: string): SourcePos
{
    const split = _.trim(fileLine).match(stackLineRe);
    if (!split || !Log.sourceMap)
    {
        return { compiled: fileLine, final: fileLine } as SourcePos;
    }

    const pos = { column: parseInt(split[4], 10), line: parseInt(split[3], 10) };

    const original = Log.sourceMap.originalPositionFor(pos);
    const line = `${split[1]} (${original.source}:${original.line})`;
    const out = {
        caller: split[1],
        compiled: fileLine,
        final: line,
        line: original.line,
        original: line,
        path: original.source,
    };

    return out;
}

function makeVSCLink(pos: SourcePos): string
{
    if (!Config.LOG_VSC.valid || !pos.caller || !pos.path || !pos.line || !pos.original)
    {
        return pos.final;
    }

    return link(vscUrl(pos.path, `L${pos.line.toString()}`), pos.original);
}

function color(str: string, color: string): string
{
    return `<font color='${color}'>${str}</font>`;
}

function tooltip(str: string, tooltip: string): string
{
    return `<abbr title='${tooltip}'>${str}</abbr>`;
}

function vscUrl(path: string, line: string): string
{
    return Config.LOG_VSC_URL_TEMPLATE(path, line);
}

function link(href: string, title: string): string
{
    return `<a href='${href}' target="_blank">${title}</a>`;
}

function time(): string
{
    return color(Game.time.toString(), "gray");
}

export class Log
{
    public static sourceMap: any;

    public static loadSourceMap()
    {
        try
        {
            // tslint:disable-next-line
            var SourceMapConsumer = require("source-map").SourceMapConsumer;
            const map = require("main.js.map");
            if (map)
            {
                Log.sourceMap = new SourceMapConsumer(map);
            }
        } catch (err)
        {
            console.log("failed to load source map", err);
        }
    }

    public get level(): number { return Memory.log.level; }
    public set level(value: number) { Memory.log.level = value; }
    public get showSource(): boolean { return Memory.log.showSource; }
    public set showSource(value: boolean) { Memory.log.showSource = value; }
    public get showTick(): boolean { return Memory.log.showTick; }
    public set showTick(value: boolean) { Memory.log.showTick = value; }

    private _maxFileString: number = 0;

    constructor()
    {
        _.defaultsDeep(Memory, {
            log: {
                level: Config.LOG_LEVEL,
                showSource: Config.LOG_PRINT_LINES,
                showTick: Config.LOG_PRINT_TICK,
            }
        });
    }

    public trace(error: Error): Log
    {
        if (this.level >= LogLevels.ERROR && error.stack)
        {
            console.log(this.resolveStack(error.stack));
        }

        return this;
    }

    public error(...args: any[])
    {
        if (this.level >= LogLevels.ERROR)
        {
            console.log.apply(this, this.buildArguments(LogLevels.ERROR).concat([].slice.call(args)));
        }
    }

    public warning(...args: any[])
    {
        if (this.level >= LogLevels.WARNING)
        {
            console.log.apply(this, this.buildArguments(LogLevels.WARNING).concat([].slice.call(args)));
        }
    }

    public info(...args: any[])
    {
        if (this.level >= LogLevels.INFO)
        {
            console.log.apply(this, this.buildArguments(LogLevels.INFO).concat([].slice.call(args)));
        }
    }

    public debug(...args: any[])
    {
        if (this.level >= LogLevels.DEBUG)
        {
            console.log.apply(this, this.buildArguments(LogLevels.DEBUG).concat([].slice.call(args)));
        }
    }

    public getFileLine(upStack = 4): string
    {
        const stack = new Error("").stack;

        if (stack)
        {
            const lines = stack.split("\n");

            if (lines.length > upStack)
            {
                const originalLines = _.drop(lines, upStack).map(resolve);
                const hoverText = _.map(originalLines, "final").join("&#10;");
                return this.adjustFileLine(
                    originalLines[0].final,
                    tooltip(makeVSCLink(originalLines[0]), hoverText)
                );
            }
        }
        return "";
    }

    private buildArguments(level: number): string[]
    {
        const out: string[] = [];
        switch (level)
        {
            case LogLevels.ERROR:
                out.push(color("ERROR  ", "red"));
                break;
            case LogLevels.WARNING:
                out.push(color("WARNING", "yellow"));
                break;
            case LogLevels.INFO:
                out.push(color("INFO   ", "green"));
                break;
            case LogLevels.DEBUG:
                out.push(color("DEBUG  ", "gray"));
                break;
            default:
                break;
        }
        if (this.showTick)
        {
            out.push(time());
        }
        if (this.showSource)
        {
            out.push(this.getFileLine());
        }
        return out;
    }

    private resolveStack(stack: string): string
    {
        if (!Log.sourceMap)
        {
            return stack;
        }

        return _.map(stack.split("\n").map(resolve), "final").join("\n");
    }

    private adjustFileLine(visibleText: string, line: string): string
    {
        const newPad = Math.max(visibleText.length, this._maxFileString);
        this._maxFileString = Math.min(newPad, Config.LOG_MAX_PAD);
        this._maxFileString = Config.LOG_MAX_PAD;

        return `|${_.padRight(line, line.length + this._maxFileString - visibleText.length, " ")}|`;
    }
}

if (Config.LOG_LOAD_SOURCE_MAP)
{
    Log.loadSourceMap();
}

export const log = new Log();

global.log = log;
