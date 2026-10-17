<script lang="ts">
    import { SvelteMap } from 'svelte/reactivity';

    import {
        addCut,
        canRedo,
        canUndo,
        CELL_HEIGHT,
        CELL_WIDTH,
        computeEffectiveCurrentTime,
        computeEffectiveDuration,
        currentCuts,
        effectiveToRawTime,
        entriesInView,
        formatTime,
        frameAt,
        overviewGeometry,
        redo,
        resolveSeekTarget,
        restoreCut,
        SAMPLE_INTERVAL,
        selectionToRange,
        stripLayout,
        undo,
        ZOOM_LEVELS,
        zoomLabel,
        type CutHistory,
        type StripEntry,
        type StripItem
    } from '$lib/editorMath.js';
    import { errorDetails, exportFailureReason } from '$lib/errors.js';
    import type { EditorPhase } from '$lib/types.js';
    import { exportFilename } from '$lib/utils.js';

    import EditorView from './EditorView.svelte';
    import VideoPlayer from './VideoPlayer.svelte';

    interface Props {
        /** The joined recording; null while takes are still being joined. */
        videoUrl: string | null;
        phase: EditorPhase;
        progress?: number;
        takeCount: number;
        /** The cuts, with undo and redo; owned by +page.svelte so they survive Back. */
        history: CutHistory;
        /** The file just saved, for the Exported notice. */
        exportedFile?: string | null;
        exportError?: unknown;
        onback: () => void;
        /** Confirmed: export to this file name. */
        onexport: (filename: string) => void;
        /** Confirmed: delete every take, cut and the crash store. */
        ondiscard: () => void;
    }

    let {
        videoUrl,
        phase,
        progress = 0,
        takeCount,
        history = $bindable(),
        exportedFile = $bindable(null),
        exportError = null,
        onback,
        onexport,
        ondiscard
    }: Props = $props();

    // Playback, bound to the <video>
    let paused = $state(true);
    let currentTime = $state(0);
    let duration = $state(0);
    let videoWidth = $state(0);
    let videoHeight = $state(0);
    const videoAspect = $derived(videoWidth && videoHeight ? videoWidth / videoHeight : null);

    // Edit state
    let trimming = $state(false);
    let zoom = $state(0);
    let anchor = $state<number | null>(null);
    let selected = $state(new Set<number>());
    let offset = $state(0);
    let viewWidth = $state(0);
    let exportOpen = $state(false);
    let discardOpen = $state(false);
    let newRecordingOpen = $state(false);
    // Named when the Export dialog opens, so the file is saved as it said
    let filename = $state(exportFilename());
    const thumbnails = new SvelteMap<number, string>();

    // The strip starts 24px in
    const PAD = 24;

    let cuts = $derived(currentCuts(history));
    let interval = $derived<number>(ZOOM_LEVELS[zoom]);
    let kept = $derived(computeEffectiveDuration(duration, cuts));
    let keptTime = $derived(computeEffectiveCurrentTime(currentTime, cuts));
    let layout = $derived(stripLayout(duration, cuts, interval));
    let inView = $derived(entriesInView(layout.entries, offset - PAD, viewWidth));
    let current = $derived(frameAt(layout.entries, currentTime));
    let locked = $derived(phase !== 'ready' && phase !== 'failed');

    let strip = $derived<StripItem[]>(
        inView.map((e) =>
            e.kind === 'cut'
                ? { kind: 'cut', cut: e.cut, seconds: e.seconds }
                : {
                      kind: 'frame',
                      cell: e.cell,
                      thumb: thumbnails.get(e.base) ?? null,
                      current: e === current,
                      marked: trimming && selected.has(e.cell)
                  }
        )
    );
    let leading = $derived(inView.length && inView[0].x > 0 ? inView[0].x - 3 : 0);

    let labels = $derived.by(() => {
        const frames = inView.filter(
            (e): e is Extract<StripEntry, { kind: 'frame' }> =>
                e.kind === 'frame' && e.x >= offset - PAD
        );
        const middle = frames.findLast((e) => e.x <= offset - PAD + viewWidth / 2);
        const label = (e: { time: number } | undefined) =>
            e ? formatTime(computeEffectiveCurrentTime(e.time, cuts)) : '';
        return {
            start: label(frames[0]),
            middle: label(middle),
            end: `${formatTime(kept)} after cuts`
        };
    });

    function clampOffset(value: number): number {
        return Math.max(0, Math.min(value, PAD + layout.width + PAD - viewWidth));
    }

    // While playing, keep the playhead's frame in view
    $effect(() => {
        if (paused || !current) return;
        const x = current.x + PAD;
        if (x < offset || x + CELL_WIDTH > offset + viewWidth) {
            offset = clampOffset(x - viewWidth / 3);
        }
    });

    // The file is named as the Export dialog opens
    $effect(() => {
        if (exportOpen) filename = exportFilename();
    });

    function seekTo(raw: number) {
        if (!(duration > 0)) return;
        currentTime = Math.min(resolveSeekTarget(raw, cuts), duration - 0.001);
    }

    function frameClick(cell: number) {
        if (locked) return;
        if (!trimming) {
            seekTo(cell * interval);
            return;
        }
        if (anchor === null) {
            anchor = cell;
            selected = new Set([cell]);
        } else {
            const [from, to] = anchor < cell ? [anchor, cell] : [cell, anchor];
            selected = new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i));
            anchor = null;
        }
    }

    function clearSelection() {
        selected = new Set();
        anchor = null;
    }

    // Only frames still in the strip count towards the selection's length
    let selectedFrames = $derived(
        layout.entries.filter((e) => e.kind === 'frame' && selected.has(e.cell)).length
    );

    function remove() {
        if (selected.size === 0) return;
        // A cut taking the last frame runs to the end: that frame's cell can stop
        // short of it, or run past it
        const range = selectionToRange(selected, interval);
        const toEnd = range.endTime > duration - interval;
        history = addCut(history, { ...range, endTime: toEnd ? duration : range.endTime });
        clearSelection();
        seekTo(currentTime);
    }

    function setZoom(level: number) {
        zoom = level;
        clearSelection();
        // Keep the playhead's frame in the middle of the strip
        const frame = frameAt(stripLayout(duration, cuts, ZOOM_LEVELS[level]).entries, currentTime);
        offset = 0;
        if (frame) offset = clampOffset(frame.x + PAD - viewWidth / 2);
    }

    // Thumbnails: the frames in view first, then outwards, flushed in batches so
    // a long recording stays responsive. Keyed by 0.2 s cell, shared by every zoom.
    $effect(() => {
        if (!videoUrl) return;
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        const canvas = document.createElement('canvas');
        canvas.width = CELL_WIDTH;
        canvas.height = CELL_HEIGHT;
        const ctx = canvas.getContext('2d');
        let cancelled = false;

        (async () => {
            await new Promise<void>((resolve) => {
                video.onloadedmetadata = () => resolve();
                video.load();
            });
            // Generated but not yet shown; not reactive on purpose
            let batch: Record<number, string> = {};
            let flushed = performance.now();
            const flush = () => {
                for (const [base, url] of Object.entries(batch)) thumbnails.set(Number(base), url);
                batch = {};
                flushed = performance.now();
            };
            while (!cancelled) {
                const centre = offset - PAD + viewWidth / 2;
                const next = layout.entries
                    .filter(
                        (e): e is Extract<StripEntry, { kind: 'frame' }> =>
                            e.kind === 'frame' && !thumbnails.has(e.base) && !(e.base in batch)
                    )
                    .sort((a, b) => Math.abs(a.x - centre) - Math.abs(b.x - centre))[0];
                if (!next) {
                    flush();
                    // Nothing left in this layout: wait for a zoom, pan or cut
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    continue;
                }
                video.currentTime = next.base * SAMPLE_INTERVAL;
                await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
                if (cancelled) return;
                ctx?.drawImage(video, 0, 0, CELL_WIDTH, CELL_HEIGHT);
                batch[next.base] = canvas.toDataURL('image/jpeg', 0.6);
                if (Object.keys(batch).length >= 8 || performance.now() - flushed > 150) flush();
            }
        })();

        return () => {
            cancelled = true;
            video.src = '';
        };
    });

    let cutWord = $derived(cuts.length === 1 ? 'cut' : 'cuts');
    let discardBody = $derived(
        `${takeCount === 1 ? 'The take' : takeCount === 2 ? 'Both takes' : `All ${takeCount} takes`}${cuts.length ? ` and your ${cutWord}` : ''} ${takeCount === 1 && !cuts.length ? 'is' : 'are'} deleted from this browser, including the copy kept in case it crashes. This can't be undone.`
    );
</script>

<EditorView
    {phase}
    {progress}
    joiningTitle="Joining {takeCount} takes"
    exportingNote={cuts.length
        ? `Applying your ${cutWord}. Editing unlocks when the file is saved.`
        : 'Saving your recording. Editing unlocks when the file is saved.'}
    {exportedFile}
    failure={phase === 'failed'
        ? { reason: exportFailureReason(exportError), details: errorDetails(exportError) }
        : null}
    {paused}
    {videoAspect}
    time="{formatTime(keptTime)} / {formatTime(kept)}"
    percent={kept > 0 ? Math.min(100, (100 * keptTime) / kept) : 0}
    {trimming}
    canUndo={canUndo(history)}
    canRedo={canRedo(history)}
    zoomLabel={zoomLabel(interval)}
    canZoomIn={zoom > 0}
    canZoomOut={zoom < ZOOM_LEVELS.length - 1}
    selection={selectedFrames ? `${Math.round(selectedFrames * interval * 10) / 10} s` : ''}
    overview={overviewGeometry(layout.width, offset, viewWidth, cuts, duration, currentTime)}
    {strip}
    stripLeading={leading}
    stripOffset={offset}
    bind:stripWidth={viewWidth}
    {labels}
    bind:exportOpen
    bind:discardOpen
    bind:newRecordingOpen
    exportDetails={[
        { label: 'Length', value: formatTime(kept) },
        { label: 'Cuts', value: String(cuts.length) },
        { label: 'File', value: filename }
    ]}
    {discardBody}
    {onback}
    ontoggleplay={() => {
        // At the end of what's kept, Play starts again from the beginning
        if (paused && kept - keptTime < 0.1) seekTo(0);
        paused = !paused;
    }}
    onseek={(percent) => seekTo(effectiveToRawTime((percent / 100) * kept, cuts, duration))}
    ontoggletrim={() => {
        trimming = !trimming;
        clearSelection();
    }}
    onundo={() => (history = undo(history))}
    onredo={() => (history = redo(history))}
    onzoomin={() => setZoom(zoom - 1)}
    onzoomout={() => setZoom(zoom + 1)}
    onremove={remove}
    onpanto={(fraction) =>
        (offset = clampOffset(fraction * (layout.width + 2 * PAD) - viewWidth / 2))}
    onpanby={(delta) => (offset = clampOffset(offset + delta))}
    onframeclick={frameClick}
    onrestore={(cut) => {
        if (!locked) history = restoreCut(history, cut);
    }}
    ondismissexported={() => (exportedFile = null)}
    onretry={() => onexport(filename)}
    onconfirmexport={() => onexport(filename)}
    onconfirmdiscard={ondiscard}
    onconfirmnewrecording={ondiscard}
>
    {#snippet video()}
        {#if videoUrl}
            <VideoPlayer
                {videoUrl}
                deletedRanges={cuts}
                bind:paused
                bind:currentTime
                bind:duration
                bind:videoWidth
                bind:videoHeight
            />
        {/if}
    {/snippet}
</EditorView>
