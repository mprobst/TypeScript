/** @internal */
namespace ts {
    declare const process: any;

    /**
     * g3PrefetchFiles asynchronously prefetches files stored on objfs. It is called before
     * compilation to improve performance.
     *
     * Regular file systems have low latency to read individual files, but bad parallelism (due to
     * hard drive head seeks, but also non-locality of reads in SSD blocks on newer drives).
     *
     * In contrast, google3 projects store files on exotic network file systems like objfs and
     * srcfs, which have exactly opposite characteristics: they have very high latency to read
     * individual files, but great parallelism as they read files from many servers across the
     * network.
     *
     * The TypeScript compiler reads files sequentially, which causes slow compiles due to the
     * above. The code below is called on project load and triggers an asynchronous objfs prefetch
     * of all input files. Experimentally, with a completely empty objfs cache, this improves the
     * initial language service startup from >300 seconds to ~5 seconds on the example Angular
     * project in google3.
     */
    export function g3PrefetchFiles(host: {trace?(msg: string): void}|undefined, fileNames: ReadonlyArray<string>) {
        if (typeof process === 'undefined' || process.browser || typeof require === 'undefined') {
            return;  // might not be running in Node.
        }
        const {spawn} = require('child_process');

        const toFetch = [...fileNames];
        // For any .d.ts file, include corresponding .metadata.json files read by the Angular IDE
        // service. This will attempt to read files that do not exist, but that's OK.
        toFetch.push(
            ...fileNames.filter(fn => fn.match(/\.d\.ts$/))
                .map(fn => fn.replace(/\.d\.ts$/, '.metadata.json')));

        // Spawn objfsutil prefetch.
        const trace = host && host.trace ? host.trace : () => {};
        trace(`objfsutil prefetch'ing ${toFetch.length} files.`);
        const objfsutil = spawn('objfsutil', ['prefetch'],
            // Make stdin a writable pipe, use stderr for all output so that we don't break
            // process communication.
            {stdio: ['pipe', process.stderr, process.stderr]});

        objfsutil.on('error', (err: {code: string}) => {
            if (err.code === 'ENOENT') {
                // Ignore a missing objfsutil binary - on Forge objfsutil doesn't exist.
                // If we didn't handle the error events, the Node process would die with an
                // "unhandled error event" message.
                trace(`ENOENT on objfsutil, running on forge? ${err}`);
                return;
            }
            // For other error situations, fail.
            trace(`spawning objfsutil failed: ${err}`);
            process.exitCode = 1;
        });
        objfsutil.on('close', ts.noop);

        objfsutil.stdin.setDefaultEncoding('utf-8');
        // stdin might be gone because the process failed to spawn - ignore.
        objfsutil.stdin.on('error', ts.noop);

        // We don't handle NodeJS stream style drain events. This is safe: the possible error
        // case is NodeJS running out of memory trying to buffer all input to the stream, which
        // is unlikely to occur for the single digit megabyte of file name lists this code is
        // writing here.
        objfsutil.stdin.write(toFetch.join('\n'), () => {
            objfsutil.stdin.end();
        });
    }
}
