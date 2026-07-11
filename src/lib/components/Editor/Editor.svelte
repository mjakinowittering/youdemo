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
    let collapsingCells = $state(new Set<number>());

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

        collapsingCells = new Set(selectedCells);
        await new Promise<void>((resolve) => setTimeout(resolve, 250));

        deletedRanges = [...deletedRanges, selectionToRange(selectedCells)];

        selectedCells = new Set();
        anchorCell = null;
        collapsingCells = new Set();
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
        {effectiveCurrentTime}
        {effectiveDuration}
        ontoggleplay={() => (paused = !paused)}
        onseek={(effectiveTarget) =>
            seekTo(effectiveToRawTime(effectiveTarget, deletedRanges, videoDuration))}
    />

    <EditorToolbar
        {editMode}
        {canDelete}
        {effectiveDuration}
        ontogglecut={toggleEditMode}
        ondelete={deleteSelectedCells}
    />

    {#if videoDuration > 0}
        <FrameStrip
            {visibleCells}
            {thumbnails}
            {currentCell}
            {selectedCells}
            {collapsingCells}
            {paused}
            oncellclick={handleCellClick}
        />
    {/if}

    <EditorFooter
        onback={() => onback()}
        ondiscard={() => ondiscard()}
        onexport={() => onexport(deletedRanges, videoDuration)}
    />
</div>
