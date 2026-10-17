<script lang="ts">
    import { onMount } from 'svelte';
    import { SvelteMap } from 'svelte/reactivity';

    import {
        CELL_HEIGHT,
        CELL_WIDTH,
        computeCellCount,
        computeDeletedCells,
        computeEffectiveCurrentTime,
        computeEffectiveDuration,
        computeVisibleCells,
        effectiveToRawTime,
        formatTime,
        resolveSeekTarget,
        SAMPLE_INTERVAL,
        selectionToRange
    } from '$lib/editorMath.js';
    import type { DeletedRange } from '$lib/types.js';

    import EditorFooter from './EditorFooter.svelte';
    import EditorToolbar from './EditorToolbar.svelte';
    import FrameStrip from './FrameStrip.svelte';
    import Scrubber from './Scrubber.svelte';
    import VideoPlayer from './VideoPlayer.svelte';

    interface Props {
        onback: () => void;
        onexport: (deletedRanges: DeletedRange[], totalDuration: number) => void;
        ondiscard: () => void;
        videoUrl?: string | null;
    }

    let { onback, onexport, ondiscard, videoUrl = null }: Props = $props();

    // Player state — bound to VideoPlayer, single source of truth for the shell.
    let paused = $state(true);
    let currentTime = $state(0);
    let videoDuration = $state(0);

    // Edit state.
    let thumbnails = new SvelteMap<number, string>();
    let deletedRanges = $state<DeletedRange[]>([]);
    let editMode = $state(false);
    let anchorCell = $state<number | null>(null);
    let selectedCells = $state(new Set<number>());

    // Derived timeline math (all pure — see editorMath.ts).
    let cellCount = $derived(computeCellCount(videoDuration));
    let currentCell = $derived(Math.round(currentTime / SAMPLE_INTERVAL));
    let deletedCells = $derived(computeDeletedCells(cellCount, deletedRanges));
    let visibleCells = $derived(computeVisibleCells(cellCount, deletedCells));
    let effectiveDuration = $derived(computeEffectiveDuration(videoDuration, deletedRanges));
    let effectiveCurrentTime = $derived(computeEffectiveCurrentTime(currentTime, deletedRanges));
    let canDelete = $derived(editMode && selectedCells.size > 0);

    // Seek: snap out of deleted spans, clamp, then drive the player via bound currentTime.
    function seekTo(rawTarget: number) {
        if (!(videoDuration > 0)) return;
        const resolved = resolveSeekTarget(rawTarget, deletedRanges);
        currentTime = Math.min(resolved, videoDuration - 0.001);
    }

    function handleCellClick(cellIndex: number) {
        if (!editMode) {
            seekTo(cellIndex * SAMPLE_INTERVAL);
            return;
        }

        if (anchorCell === null) {
            anchorCell = cellIndex;
            selectedCells = new Set([cellIndex]);
        } else {
            const start = Math.min(anchorCell, cellIndex);
            const end = Math.max(anchorCell, cellIndex);
            selectedCells = new Set(Array.from({ length: end - start + 1 }, (_, i) => start + i));
            anchorCell = null;
        }
    }

    async function deleteSelectedCells() {
        if (selectedCells.size === 0) return;

        deletedRanges = [...deletedRanges, selectionToRange(selectedCells)];

        selectedCells = new Set();
        anchorCell = null;
        editMode = false;
    }

    function toggleEditMode() {
        editMode = !editMode;
        if (!editMode) {
            selectedCells = new Set();
            anchorCell = null;
        }
    }

    // Thumbnail strip — generated off-DOM by seeking a hidden <video> and drawing
    // each sample frame to a canvas. Browser-bound; not part of the pure math.
    onMount(() => {
        if (!videoUrl) return;
        const thumbVideo = document.createElement('video');
        thumbVideo.src = videoUrl;
        thumbVideo.muted = true;
        let cancelled = false;

        (async () => {
            await new Promise<void>((resolve) => {
                thumbVideo.onloadedmetadata = () => resolve();
                thumbVideo.load();
            });
            const count = computeCellCount(thumbVideo.duration);
            for (let i = 0; i < count; i++) {
                if (cancelled) return;
                thumbVideo.currentTime = i * SAMPLE_INTERVAL;
                await new Promise<void>((resolve) => {
                    thumbVideo.onseeked = () => resolve();
                });
                if (cancelled) return;
                const canvas = document.createElement('canvas');
                canvas.width = CELL_WIDTH;
                canvas.height = CELL_HEIGHT;
                canvas.getContext('2d')?.drawImage(thumbVideo, 0, 0, CELL_WIDTH, CELL_HEIGHT);
                thumbnails.set(i, canvas.toDataURL('image/jpeg', 0.6));
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        })();

        return () => {
            cancelled = true;
            thumbVideo.src = '';
        };
    });
</script>

<div class="flex h-full flex-col">
    <VideoPlayer
        {videoUrl}
        {deletedRanges}
        bind:paused
        bind:currentTime
        bind:duration={videoDuration}
    />

    <Scrubber
        {paused}
        time="{formatTime(effectiveCurrentTime)} / {formatTime(effectiveDuration)}"
        percent={effectiveDuration > 0 ? (100 * effectiveCurrentTime) / effectiveDuration : 0}
        ontoggleplay={() => (paused = !paused)}
        onseek={(percent) =>
            seekTo(
                effectiveToRawTime(
                    (percent / 100) * effectiveDuration,
                    deletedRanges,
                    videoDuration
                )
            )}
    />

    <EditorToolbar
        trimming={editMode}
        canUndo={false}
        canRedo={false}
        zoomLabel="0.2 s a frame"
        canZoomIn={false}
        canZoomOut={false}
        selection={canDelete ? `${(selectedCells.size * SAMPLE_INTERVAL).toFixed(1)} s` : ''}
        ontoggletrim={toggleEditMode}
        onundo={() => {}}
        onredo={() => {}}
        onzoomin={() => {}}
        onzoomout={() => {}}
        onremove={deleteSelectedCells}
    />

    {#if videoDuration > 0}
        <div class="overflow-hidden">
            <FrameStrip
                class="pt-[30px] pl-6"
                items={visibleCells.map((cell) => ({
                    kind: 'frame' as const,
                    cell,
                    thumb: thumbnails.get(cell) ?? null,
                    current: cell === currentCell,
                    marked: selectedCells.has(cell)
                }))}
                onframeclick={handleCellClick}
                onrestore={() => {}}
            />
        </div>
    {/if}

    <EditorFooter
        onback={() => onback()}
        ondiscard={() => ondiscard()}
        onexport={() => onexport(deletedRanges, videoDuration)}
    />
</div>
