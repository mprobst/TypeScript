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
    export function g3PrefetchFiles(fileNames: ReadonlyArray<string>) {
        if (process.browser || typeof require === 'undefined') {
            return;  // might not be running in Node.
        }
        const {spawn} = require('child_process');

        // For any .d.ts file, include corresponding .metadata.json files read by the Angular IDE
        // service. This will attempt to read files that do not exist, but that's OK.
        const toFetch = [...fileNames];
        toFetch.push(
            ...fileNames.filter(fn => fn.match(/\.d\.ts$/))
                .map(fn => fn.replace(/\.d\.ts$/, '.metadata.json')));

        // Spawn objfsutil prefetch.
        const objfsutil = spawn('objfsutil', ['prefetch', ...toFetch],
            // Make stdin a writable pipe, use stderr for all output.
            {stdio: ['pipe', process.stderr, process.stderr]});

        // Ignore errors, the process spawn common fails on Forge where objfsutil doesn't exist.
        objfsutil.on('error', ts.noop);
        objfsutil.on('close', ts.noop);

        // TODO(martinprobst): the list of files should be passed via stdin with the code below, but
        // that fails due to: https://github.com/nodejs/node/issues/21941

        // objfsutil.stdin.setDefaultEncoding('utf-8');
        // objfsutil.stdin.on('error', ts.noop);

        // We don't handle NodeJS stream style drain events. This is safe: the possible error case
        // is NodeJS running out of memory trying to buffer all input to the stream, which is
        // unlikely to occur for the single digit megabyte of file name lists this code is writing
        // here.
        // objfsutil.stdin.write(toFetch.join('\n'), () => {
        //     objfsutil.stdin.end();
        // })
    }
}
